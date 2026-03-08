import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Safe JSON parse helper — returns null on empty/invalid body
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text || text.trim().length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

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

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new Error("Body JSON inválido o vacío");
    }
    const { action } = body;

    // Configurable: set FACTURAMA_ENV=production to use live API
    const FACTURAMA_ENV = Deno.env.get("FACTURAMA_ENV") || "sandbox";
    const baseUrl = FACTURAMA_ENV === "production"
      ? "https://api.facturama.mx"
      : "https://apisandbox.facturama.mx";

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
      return fetch(`${baseUrl}${path}`, opts);
    };

    // ─── ACTION: test-connection ───
    if (action === "test-connection") {
      const res = await facturama("/api/Profile");
      const data = await safeJson(res);
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

      // Call Facturama API Web to stamp
      console.log("Stamping CFDI payload:", JSON.stringify(cfdiPayload));
      const stampRes = await facturama("/3/cfdis", "POST", cfdiPayload);
      const stampData = await safeJson(stampRes);

      console.log("Facturama stamp response status:", stampRes.status, "data:", JSON.stringify(stampData));

      if (!stampRes.ok) {
        // Update invoice with error
        await supabase
          .from("invoices")
          .update({
            status: "error_timbrado",
            pac_response: stampData || { status: stampRes.status },
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice_id);
        throw new Error(`Error de timbrado (HTTP ${stampRes.status}): ${JSON.stringify(stampData)}`);
      }

      // Extract UUID and update invoice
      const uuid = stampData.Complement?.TaxStamp?.Uuid || stampData.Id || "";

      // Download XML
      let xmlPath = "";
      try {
        const xmlRes = await facturama(`/api/Cfdi/xml/issued/${stampData.Id || uuid}`, "GET");
        if (xmlRes.ok) {
          const xmlContent = await xmlRes.text();
          xmlPath = `xml/${invoice_id}.xml`;
          await supabase.storage.from("invoicing").upload(xmlPath, new Blob([xmlContent], { type: "text/xml" }), { upsert: true });
        }
      } catch { /* non-critical */ }

      // Download PDF
      let pdfPath = "";
      try {
        const pdfRes = await facturama(`/api/Cfdi/pdf/issued/${stampData.Id || uuid}`, "GET");
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

    // ─── ACTION: generate-complement (CFDI tipo P) ───
    if (action === "generate-complement") {
      const { payment_id } = body;
      if (!payment_id) throw new Error("payment_id requerido");

      // Fetch payment
      const { data: payment, error: payErr } = await supabase
        .from("payments")
        .select("*")
        .eq("id", payment_id)
        .single();
      if (payErr || !payment) throw new Error("Pago no encontrado");
      if (payment.complement_status === "generado") throw new Error("El complemento ya fue generado para este pago");

      // Fetch related invoice
      const { data: invoice, error: invErr2 } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", payment.invoice_id)
        .single();
      if (invErr2 || !invoice) throw new Error("Factura relacionada no encontrada");
      if (!invoice.uuid) throw new Error("La factura no tiene UUID (no ha sido timbrada)");

      // Fetch fiscal settings
      const { data: fiscal2 } = await supabase
        .from("fiscal_settings")
        .select("*")
        .limit(1)
        .single();
      if (!fiscal2) throw new Error("Configuración fiscal no encontrada");

      // Fetch customer fiscal data
      let receiver2: any = { Rfc: "XAXX010101000", Name: "PÚBLICO EN GENERAL", CfdiUse: "CP01", FiscalRegime: "616", TaxZipCode: "00000" };
      if (invoice.customer_id) {
        const { data: custFiscal2 } = await supabase
          .from("customer_fiscal_data")
          .select("*")
          .eq("customer_id", invoice.customer_id)
          .single();
        if (custFiscal2) {
          receiver2 = {
            Rfc: custFiscal2.rfc,
            Name: custFiscal2.legal_name,
            CfdiUse: "CP01",
            FiscalRegime: custFiscal2.tax_regime,
            TaxZipCode: custFiscal2.fiscal_zip_code,
          };
        }
      }

      // Determine parcialidad number (count previous payments on same invoice)
      const { data: prevPayments } = await supabase
        .from("payments")
        .select("id")
        .eq("invoice_id", payment.invoice_id)
        .lt("created_at", payment.created_at)
        .order("created_at", { ascending: true });
      const partiality = (prevPayments?.length ?? 0) + 1;

      // Build CFDI tipo P payload for Facturama
      const complementPayload = {
        Currency: "XXX",
        ExpeditionPlace: fiscal2.expedition_zip_code,
        CfdiType: "P",
        PaymentForm: "99",
        PaymentMethod: "PUE",
        Issuer: {
          Rfc: fiscal2.issuer_rfc,
          Name: fiscal2.issuer_name,
          FiscalRegime: fiscal2.issuer_tax_regime,
        },
        Receiver: receiver2,
        Complemento: {
          Payments: [
            {
              Date: payment.payment_date,
              PaymentForm: payment.payment_form,
              Currency: payment.currency || "MXN",
              ExchangeRate: payment.exchange_rate || 1,
              Amount: payment.amount,
              RelatedDocuments: [
                {
                  Uuid: invoice.uuid,
                  Series: invoice.series,
                  Folio: invoice.folio,
                  Currency: invoice.currency || "MXN",
                  ExchangeRate: invoice.exchange_rate || 1,
                  PaymentMethod: invoice.payment_method || "PPD",
                  PartialityNumber: partiality,
                  PreviousBalanceAmount: payment.previous_balance,
                  AmountPaid: payment.amount,
                  ImpSaldoInsoluto: payment.remaining_balance,
                },
              ],
            },
          ],
        },
      };

      // Call Facturama API Web to stamp complement
      console.log("Complement payload:", JSON.stringify(complementPayload));
      const compRes = await facturama("/3/cfdis", "POST", complementPayload);
      const compData = await safeJson(compRes);

      console.log("Facturama complement response status:", compRes.status, "data:", JSON.stringify(compData));

      if (!compRes.ok) {
        // Update payment with error
        await supabase
          .from("payments")
          .update({
            complement_status: "error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment_id);
        throw new Error(`Error al generar complemento (HTTP ${compRes.status}): ${JSON.stringify(compData)}`);
      }

      const compUuid = compData.Complement?.TaxStamp?.Uuid || compData.Id || "";

      // Download XML
      let compXmlPath = "";
      try {
        const xmlRes = await facturama(`/cfdi/xml/${compData.Id || compUuid}/issued`, "GET");
        if (xmlRes.ok) {
          const xmlContent = await xmlRes.text();
          compXmlPath = `xml/complement_${payment_id}.xml`;
          await supabase.storage.from("invoicing").upload(compXmlPath, new Blob([xmlContent], { type: "text/xml" }), { upsert: true });
        }
      } catch { /* non-critical */ }

      // Download PDF
      let compPdfPath = "";
      try {
        const pdfRes = await facturama(`/cfdi/pdf/${compData.Id || compUuid}/issued`, "GET");
        if (pdfRes.ok) {
          const pdfBlob = await pdfRes.blob();
          compPdfPath = `pdf/complement_${payment_id}.pdf`;
          await supabase.storage.from("invoicing").upload(compPdfPath, pdfBlob, { contentType: "application/pdf", upsert: true });
        }
      } catch { /* non-critical */ }

      // Update payment record
      await supabase
        .from("payments")
        .update({
          complement_status: "generado",
          complement_uuid: compUuid,
          complement_xml_path: compXmlPath,
          complement_pdf_path: compPdfPath,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment_id);

      return new Response(
        JSON.stringify({ success: true, uuid: compUuid, data: compData }),
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

    // ─── ACTION: download-complement ───
    if (action === "download-complement") {
      const { payment_id, file_type } = body;
      const { data: payment } = await supabase
        .from("payments")
        .select("complement_xml_path, complement_pdf_path, complement_uuid")
        .eq("id", payment_id)
        .single();
      if (!payment) throw new Error("Pago no encontrado");

      const path = file_type === "xml" ? payment.complement_xml_path : payment.complement_pdf_path;
      if (!path) throw new Error(`Archivo ${file_type} del complemento no disponible`);

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
