// Payment types for orders

export interface Payment {
  id: string;
  orderId: string;
  date: string;
  amount: number;
  method: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'otro';
  reference: string;
  comment: string;
  registeredBy: string;
}

export type PaymentStatus = 'sin_pago' | 'anticipo_recibido' | 'pago_parcial' | 'liquidado';
