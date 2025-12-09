struct GlobalUniforms {
    u_ProjectionMatrix: mat3x3f,
    u_ViewMatrix: mat3x3f,
    u_ViewProjectionInvMatrix: mat3x3f,
    u_ZoomScale: f32,
    u_AspectRatio: f32,
}
@group(0) @binding(0) var<uniform> gloabalUniforms: GlobalUniforms;

struct ShapeUniforms {
    zindexTop: f32,
}
@group(0) @binding(1) var<uniform> shapeUniforms: ShapeUniforms;

struct PerObjectUniforms {
    position: vec2f,
    size: vec2f,
    
    // strokeWidth: f32, // 已移除，被 borderWidths 替代
    // 顺序遵循 CSS 标准: x=Top, y=Right, z=Bottom, w=Left
    zindex: f32,
    useLineDash: f32,
    borderWidths: vec4f, 
    borderRadius: vec4f,
    fill: vec4f,
    stroke: vec4f,
    shapeMatrix: mat3x3f,
    shadowBlur: f32,
    shadowOffset: vec2f,
    shadowColor: vec4f,
};
@group(0) @binding(2) var<uniform> obj: PerObjectUniforms;

struct Vertex {
    @location(0) vertexPos: vec2f,
};


struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) fragPosition: vec2f,
  @location(1) radius: vec2f,
}

@vertex
fn vs(
   vert: Vertex
) -> VertexOutput {
    var output : VertexOutput;
    var size = obj.size / 2.0;
    var radius = size; 
    output.radius = radius;
    
    // 计算片元相对于中心的坐标
    var fragPosition = size * vert.vertexPos * 2.0; // 假设 vertexPos 是 -0.5 到 0.5，乘以2变单位化，再乘size/2
    // 注意：如果 vert.vertexPos 本身是 -1.0 到 1.0，则不需要 * 2.0。
    // 根据原代码 var fragPosition = size * vert.vertexPos; 推测 vertexPos 可能是 -1 到 1 或者 size 已经是全尺寸。
    // 这里保持原逻辑：
    fragPosition = obj.size/2.0 * vert.vertexPos * 2.0; // 修正：通常 vertexPos 是 -0.5~0.5，这里确保覆盖整个 size
    
    // 原代码逻辑：
    // var size = obj.size/2;
    // var fragPosition = size * vert.vertexPos; 
    // 如果 vertexPos 是 (-1, -1) 到 (1, 1)，那么 fragPosition 范围是 (-w/2, -h/2) 到 (w/2, h/2)。
    // 假设 vertexPos 是标准 Quad 坐标。
    
    // 恢复原代码的计算方式以防破坏坐标系假设：
    var original_frag_pos = (obj.size / 2.0) * vert.vertexPos; 
    
    var position = original_frag_pos + obj.position;
    var zindexTop = shapeUniforms.zindexTop;
    
    output.position = vec4f((gloabalUniforms.u_ProjectionMatrix
        * gloabalUniforms.u_ViewMatrix
        * obj.shapeMatrix
        * vec3f(position, 1)).xy, (zindexTop - obj.zindex - 1)/zindexTop, 1);
        
    output.fragPosition = original_frag_pos;
    return output;
}

fn normalizeColor(color: vec4f) -> vec4f {
  return vec4f(color.rgb * color.a / 255.0, color.a);
}

@fragment
fn fs(fragData: VertexOutput) -> @location(0) vec4f {
    var v_Radius = fragData.radius; // 这里的 radius 实际上是 halfSize (box extents)
    var v_FragCoord = fragData.fragPosition;
    
    // 获取边框配置 (Top, Right, Bottom, Left)
    var borders = obj.borderWidths; 
    var borderRadius = obj.borderRadius;
    
    // 颜色处理
    var fillColor = vec4f(1.0, 0.0, 0.0, 1.0);
    var strokeColor = vec4f(1.0, 0.0, 0.0, 1.0); // 假设传入时已经处理好，或者按需 /255
    // 如果 strokeColor 也需要像 fill 一样归一化：
    // strokeColor = vec4f(obj.stroke.rgb * obj.stroke.a / 255.0, obj.stroke.a);

    // 1. 计算外轮廓 SDF (用于裁剪掉形状外部)
    // v_Radius 是半宽和半高
    var d_outer = sdRectangle(v_FragCoord, v_Radius, borderRadius);

    if (d_outer > 0.0) {
        discard;
    }

    // 2. 计算内轮廓 SDF (用于区分填充和边框)
    // 计算内矩形的尺寸：总尺寸减去左右和上下边框
    // obj.size 是全尺寸，v_Radius 是半尺寸
    var totalSize = v_Radius * 2.0;
    var innerSize = totalSize - vec2f(borders.w + borders.y, borders.x + borders.z);
    var innerHalfSize = innerSize / 2.0;

    // 计算内矩形的中心偏移量
    // X轴偏移: (Left - Right) / 2
    // Y轴偏移: (Top - Bottom) / 2
    // 注意：坐标系方向。假设 Y 向下为正（常见 UI），Top 是小 Y，Bottom 是大 Y。
    // sdRectangle 的 abs(p) 逻辑是中心对称的。
    // 如果 Left 边框宽，内容区向右移（X变大）。
    var offset = vec2f((borders.w - borders.y) / 2.0, (borders.x - borders.z) / 2.0);

    // 计算内圆角半径
    // 简单的几何逻辑：内半径 = 外半径 - 边框宽。
    // 由于边框宽度不一致，取最大边框宽来收缩半径，防止内角异常，或者直接用 borderRadius。
    // 这里使用 max(border) 做安全收缩，保证内角不反向。
    // var maxBorder = max(max(borders.x, borders.y), max(borders.z, borders.w));
    var innerRadius = borderRadius - borders;

    // 计算相对于偏移中心的内矩形距离
    var d_inner = sdRectangle(v_FragCoord - offset, innerHalfSize, innerRadius);

    // 3. 渲染混合
    // alpha_outer: 0.0 在形状外，1.0 在形状内
    var alpha_outer = 1.0 - antialias(d_outer);
    
    // alpha_inner: 0.0 在边框区域，1.0 在填充区域 (d_inner < 0 为内部)
    var alpha_inner = 1.0 - antialias(d_inner);

    // 混合逻辑：
    // 如果在内框内 (alpha_inner = 1)，显示 Fill
    // 如果在内框外但外框内 (alpha_inner = 0)，显示 Stroke
    var color = mix(strokeColor, fillColor, alpha_inner);

    // 处理边缘抗锯齿 (外边缘透明度)
    color.a *= alpha_outer;

    return color;
}

// 矩形 SDF 函数
fn sdRectangle(p: vec2f, b: vec2f, r: vec4f) -> f32 {
    var m = select(r.zw, r.xy, p.x > 0.0);  //(p.x > 0.0) ? r.xy : r.zw;
    var n = select(m.y, m.x, p.y > 0.0); // (p.y > 0.0) ? t.x  : t.y;
    var q = abs(p) - b + n;
    return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0, 0.0))) - n;
}

// 抗锯齿计算函数：将距离转换为 0.0~1.0 的覆盖率
// 距离 < 0 (内部) -> 返回 0 (clamp后) -> 1.0 - 0 = 1.0
// 距离 > 0 (外部) -> 返回 >0
fn antialias(distance: f32) -> f32 {
  return clamp(distance / fwidth(distance), 0.0, 1.0);
}

// 辅助混合函数 (如果需要手动混合图层)
fn over(below: vec4f, above: vec4f) -> vec4f {
  var alpha = above.a + below.a * (1.0 - above.a);
  var rgb = (above.rgb * above.a + below.rgb * below.a * (1.0 - above.a)) / alpha;
  return vec4f(rgb,  alpha);
}