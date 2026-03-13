/** 设计构成中的一行：材料名称、尺寸、单价、数量、金额；含 image 便于前端直接套用 */
export class DesignCompositionEmbed {
  materialId: string;
  name: string;
  image: string; // 材料图片，便于 DIY 页直接渲染
  size: number; // mm，可为 0 表示未填
  price: number;
  quantity: number;
  amount?: number; // 可选，后端可存 price*quantity
}
