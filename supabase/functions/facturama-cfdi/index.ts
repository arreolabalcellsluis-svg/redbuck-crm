import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FACTURAMA_USERNAME = Deno.env.get("FACTURAMA_USERNAME");
    const FACTURAMA_PASSWORD = Deno.env.get("FACTURAMA_PASSWORD");
    if (!FACTURAMA_USERNAME || !FACTURAMA_PASSWORD) {
      throw new Error("Credenciales de Facturama no configuradas");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No autorizado");

    const body = await req.json();
    const { action } = body;

    const facturama = (path: string, method = "GET", payload?: any) => {
      const auth = btoa(`${FACTURAMA_USERNAME}:${FACTURAMA_PASSWORD}`);
      const opts: RequestInit = {
        method,
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      };
      if (payload) opts.body = JSON.stringify(payload);
      // Use sandbox for testing, production: https://api.facturama.mx
      const baseUrl = "https://apisandbox.facturama.mx";
      return fetch(`${baseUrl}${path}`, opts);
    };

    // ─── ACTION: test-connection ───
    if (action === "test-connection") {
      const res = await facturama("/api/Profile");
      const data = await res.json();
      if (!res.ok) throw new Error(`Facturama error: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify({ success: true, profile: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: stamp (timbrar) ───
    if (action === "stamp") {
      const { invoice_id } = body;
      if (!invoice_id) throw new Error("invoice_id requerido");

      // Fetch invoice
      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoice_id)
        .single();
      if (invErr || !invoice) throw new Error("Factura no encontrada");
      if (invoice.status === "timbrada") throw new Error("La factura ya está timbrada");

      // Fetch invoice items
      const { data: items } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoice_id);

      // Fetch fiscal settings
      const { data: fiscal } = await supabase
        .from("fiscal_settings")
        .select("*")
        .limit(1)
        .single();
      if (!fiscal) throw new Error("Configuración fiscal no encontrada");

      // Fetch customer fiscal data
      let receiver: any = { Rfc: "XAXX010101000", Name: "PÚBLICO EN GENERAL", CfdiUse: "S01", FiscalRegime: "616", TaxZipCode: "00000" };
      if (invoice.customer_id) {
        const { data: custFiscal } = await supabase
          .from("customer_fiscal_data")
          .select("*")
          .eq("customer_id", invoice.customer_id)
          .single();
        if (custFiscal) {
          receiver = {
            Rfc: custFiscal.rfc,
            Name: custFiscal.legal_name,
            CfdiUse: custFiscal.cfdi_use_default || "G03",
            FiscalRegime: custFiscal.tax_regime,
            TaxZipCode: custFiscal.fiscal_zip_code,
          };
        }
      }

      // Build CFDI payload for Facturama
      const cfdiItems = (items || []).map((it: any) => ({
        ProductCode: it.sat_product_key || "01010101",
        UnitCode: it.sat_unit_key || "H87",
        Description: it.description,
        Quantity: it.qty,
        UnitPrice: it.unit_price,
        Discount: it.discount || 0,
        Subtotal: it.subtotal,
        Taxes: [
          {
            Total: it.tax_amount,
            Name: "IVA",
            Base: it.subtotal,
            Rate: it.tax_amount > 0 ? (it.tax_amount / (it.subtotal || 1)) : 0.16,
            IsRetention: false,
          },
        ],
        Total: it.total,
      }));

      const cfdiPayload = {
        Currency: invoice.currency || "MXN",
        ExpeditionPlace: fiscal.expedition_zip_code,
        PaymentForm: invoice.payment_form || "99",
        PaymentMethod: invoice.payment_method || "PUE",
        CfdiType: invoice.invoice_type || "I",
        Issuer: {
          Rfc: fiscal.issuer_rfc,
          Name: fiscal.issuer_name,
          FiscalRegime: fiscal.issuer_tax_regime,
        },
        Receiver: receiver,
        Items: cfdiItems,
      };

      // Call Facturama API to stamp
      const stampRes = await facturama("/3/cfdis", "POST", cfdiPayload);
      const stampData = await stampRes.json();

      if (!stampRes.ok) {
        // Update invoice with error
        await supabase
          .from("invoices")
          .update({
            status: "error_timbrado",
            pac_response: stampData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice_id);
        throw new Error(`Error de timbrado: ${JSON.stringify(stampData)}`);
      }

      // Extract UUID and update invoice
      const uuid = stampData.Complement?.TaxStamp?.Uuid || stampData.Id || "";

      // Download XML
      let xmlPath = "";
      try {
        const xmlRes = await facturama(`/api/Cfdi/xml/${stampData.Id || uuid}`, "GET");
        if (xmlRes.ok) {
          const xmlContent = await xmlRes.text();
          xmlPath = `xml/${invoice_id}.xml`;
          await supabase.storage.from("invoicing").upload(xmlPath, new Blob([xmlContent], { type: "text/xml" }), { upsert: true });
        }
      } catch { /* non-critical */ }

      // Download PDF
      let pdfPath = "";
      try {
        const pdfRes = await facturama(`/api/Cfdi/pdf/${stampData.Id || uuid}`, "GET");
        if (pdfRes.ok) {
          const pdfBlob = await pdfRes.blob();
          pdfPath = `pdf/${invoice_id}.pdf`;
          await supabase.storage.from("invoicing").upload(pdfPath, pdfBlob, { contentType: "application/pdf", upsert: true });
        }
      } catch { /* non-critical */ }

      // Update invoice record
      await supabase
        .from("invoices")
        .update({
          uuid,
          status: "timbrada",
          pac_response: stampData,
          xml_path: xmlPath,
          pdf_path: pdfPath,
          issued_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice_id);

      return new Response(
        JSON.stringify({ success: true, uuid, stampData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ACTION: cancel ───
    if (action === "cancel") {
      const { invoice_id, reason, substitute_uuid } = body;
      if (!invoice_id) throw new Error("invoice_id requerido");

      const { data: invoice } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoice_id)
        .single();
      if (!invoice) throw new Error("Factura no encontrada");
      if (invoice.status !== "timbrada") throw new Error("Solo se pueden cancelar facturas timbradas");

      const cancelPayload: any = {
        Uuid: invoice.uuid,
        Motive: reason || "02",
      };
      if (reason === "01" && substitute_uuid) {
        cancelPayload.UuidReplacement = substitute_uuid;
      }

      const cancelRes = await facturama(`/api/Cfdi/${invoice.uuid}`, "DELETE");
      const cancelData = await cancelRes.text();

      // Update invoice
      await supabase
        .from("invoices")
        .update({
          status: "cancelada",
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice_id);

      // Create cancellation record
      const { data: { user } } = await supabase.auth.admin.listUsers();
      await supabase.from("invoice_cancellations").insert({
        invoice_id,
        cancellation_reason: reason || "02",
        substitute_uuid: substitute_uuid || null,
        canceled_by: body.canceled_by || "sistema",
        cancellation_ack_path: "",
      });

      return new Response(
        JSON.stringify({ success: true, cancelData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ACTION: download ───
    if (action === "download") {
      const { invoice_id, file_type } = body;
      const { data: invoice } = await supabase
        .from("invoices")
        .select("xml_path, pdf_path, uuid")
        .eq("id", invoice_id)
        .single();
      if (!invoice) throw new Error("Factura no encontrada");

      const path = file_type === "xml" ? invoice.xml_path : invoice.pdf_path;
      if (!path) throw new Error(`Archivo ${file_type} no disponible`);

      const { data: fileData } = await supabase.storage.from("invoicing").createSignedUrl(path, 3600);
      if (!fileData?.signedUrl) throw new Error("No se pudo generar URL de descarga");

      return new Response(
        JSON.stringify({ success: true, url: fileData.signedUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Acción no reconocida: ${action}`);
  } catch (error: any) {
    console.error("facturama-cfdi error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
