export interface OrderDataPoint {
  id: string;
  amount: number;
  category?: string;
  created_at: string;
}

export interface InventoryItemPoint {
  sku: string;
  name: string;
  stock_level: number;
  reorder_point: number;
}

export class BusinessAnalyticsML {
  /**
   * Linear Regression ML algorithm for Sales Trend & Next Period Forecast
   */
  static forecastRevenue(dailySales: { date: string; sales: number }[], periodsAhead = 3) {
    if (!dailySales || dailySales.length < 2) {
      return { trend: "insufficient_data", slope: 0, predictions: [] };
    }

    const n = dailySales.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    dailySales.forEach((pt, i) => {
      sumX += i;
      sumY += pt.sales;
      sumXY += i * pt.sales;
      sumXX += i * i;
    });

    // Calculate slope (m) and intercept (b): y = mx + b
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const predictions = [];
    for (let j = 1; j <= periodsAhead; j++) {
      const futureIndex = n - 1 + j;
      const forecastVal = Math.max(0, slope * futureIndex + intercept);
      predictions.push(Number(forecastVal.toFixed(2)));
    }

    return {
      trend: slope > 0.05 ? "upward" : slope < -0.05 ? "downward" : "flat",
      dailyGrowthVelocity: Number(slope.toFixed(2)),
      nextPredictions: predictions,
    };
  }

  /**
   * Anomaly Detection via Z-score Statistical Analysis (Outlier Orders)
   */
  static detectOrderAnomalies(orders: OrderDataPoint[], thresholdZ = 2.0) {
    if (!orders || orders.length < 4) return [];

    const amounts = orders.map((o) => Number(o.amount || 0));
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return [];

    return orders
      .map((o) => {
        const zScore = (Number(o.amount) - mean) / stdDev;
        return {
          orderId: o.id,
          amount: Number(o.amount),
          zScore: Number(zScore.toFixed(2)),
          isAnomaly: Math.abs(zScore) >= thresholdZ,
        };
      })
      .filter((res) => res.isAnomaly);
  }

  /**
   * Stock Depletion Risk Index (Inventory Machine-Learning Scorer)
   */
  static calculateDepletionRisks(inventory: InventoryItemPoint[]) {
    return inventory
      .map((item) => {
        const ratio = item.stock_level / Math.max(1, item.reorder_point);
        let risk: "CRITICAL" | "MODERATE" | "HEALTHY" = "HEALTHY";
        if (ratio <= 0.5) risk = "CRITICAL";
        else if (ratio <= 1.0) risk = "MODERATE";

        return {
          sku: item.sku,
          name: item.name,
          stock: item.stock_level,
          risk,
          ratio: Number(ratio.toFixed(2)),
        };
      })
      .sort((a, b) => a.ratio - b.ratio);
  }
}