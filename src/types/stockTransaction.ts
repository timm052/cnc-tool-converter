/** The reason a stock quantity changed. */
export type StockReason =
  | 'restock'     // received new stock
  | 'use'         // consumed / issued to machine
  | 'adjustment'  // manual correction
  | 'damage'      // damaged / written off
  | 'return'      // returned to crib
  | 'initial';    // first quantity recorded

export const STOCK_REASON_LABELS: Record<StockReason, string> = {
  restock:    'Restock',
  use:        'Used',
  adjustment: 'Adjustment',
  damage:     'Damaged',
  return:     'Return',
  initial:    'Initial',
};

/** A single stock-in / stock-out event for one tool. */
export interface StockTransaction {
  id:            string;
  toolId:        string;
  /** Signed quantity change: positive = stock in, negative = stock out. */
  delta:         number;
  /** Quantity on hand after this transaction. */
  quantityAfter: number;
  reason:        StockReason;
  note?:         string;
  timestamp:     number;
}
