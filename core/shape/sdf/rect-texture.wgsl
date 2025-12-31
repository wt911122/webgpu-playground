struct PerObjectUniforms {
    size: vec2f,
    sdfType: f32,
    useTexture: f32,
    borderWidths: vec4f, 
    borderRadius: vec4f,
    fill: vec4f,
    stroke: vec4f,
};
@group(0) @binding(0) var<uniform> obj: PerObjectUniforms;

@group(1) @binding(0) var textureSource: texture_2d<f32>;
@group(1) @binding(1) var textureSampler: sampler;

struct Vertex {
    @location(0) vertexPos: vec2f,
    @location(1) texturePos: vec2f,
};


struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) fragPosition: vec2f,
  @location(1) texcoord: vec2f
}

@vertex
fn vs(
   vert: Vertex
) -> VertexOutput {
    var output : VertexOutput;
    output.position = vec4f(vert.vertexPos, 0, 1);
    output.texcoord = vert.texturePos;
    output.fragPosition = (obj.size / 2.0) * vert.vertexPos; 
    return output;
}

fn normalizeColor(color: vec4f) -> vec4f {
  return vec4f(color.rgb * color.a / 255.0, color.a);
}


@fragment
fn fs(fragData: VertexOutput) -> @location(0) vec4f {
    var v_Radius = obj.size / 2.0;
    var v_FragCoord = fragData.fragPosition;
    
    // 获取边框配置 (Top, Right, Bottom, Left)
    // var borders = obj.borderWidths; 

    
    // 颜色处理
    var fillColor: vec4f;
    if(obj.useTexture > 0) {
        fillColor = textureSample(textureSource, textureSampler, fragData.texcoord);
    } else {
        fillColor = vec4f(obj.fill.rgb * obj.fill.a / 255.0, obj.fill.a);
    }
    
    var strokeColor = vec4f(obj.stroke.rgb * obj.stroke.a / 255.0, obj.stroke.a); // 假设传入时已经处理好，或者按需 /255
    // 如果 strokeColor 也需要像 fill 一样归一化：
    // strokeColor = vec4f(obj.stroke.rgb * obj.stroke.a / 255.0, obj.stroke.a);
    if(fillColor.a == 0.0 && strokeColor.a == 0.0) {
        discard;
    }
    // 1. 计算外轮廓 SDF (用于裁剪掉形状外部)
    // v_Radius 是半宽和半高
    var d_outer:f32;
    if(obj.sdfType == 1.0) {
        var borderRadius = obj.borderRadius;
        var b = min(v_Radius.x, v_Radius.y);
        borderRadius.x = min(borderRadius.x, b);
        borderRadius.y = min(borderRadius.y, b);
        borderRadius.z = min(borderRadius.z, b);
        borderRadius.w = min(borderRadius.w, b);
        // var borderRadius = obj.borderRadius;
        d_outer = sdRectangle(v_FragCoord, v_Radius, borderRadius);
    } 
    if(obj.sdfType == 2.0) {
        d_outer = sdEllipse(v_FragCoord, v_Radius);
    }
        

    if (d_outer > 0.0) {
        discard;
    }

    // 计算相对于偏移中心的内矩形距离
    
    var d_inner:f32 ;
    if(obj.sdfType == 1.0) {
        var borderRadius = obj.borderRadius;
        var borders = obj.borderWidths; 
        var totalSize = v_Radius * 2.0;
        var innerSize = totalSize - vec2f(borders.w + borders.y, borders.x + borders.z);
        var innerHalfSize = innerSize / 2.0;
        var offset = vec2f((borders.w - borders.y) / 2.0, (borders.x - borders.z) / 2.0);
        var innerRadius = borderRadius - borders;
        d_inner = sdRectangle(v_FragCoord - offset, innerHalfSize, innerRadius);
    }
    if(obj.sdfType == 2.0) {
        var borders = obj.borderWidths; 
        var innerHalfSize = v_Radius - vec2f(borders.w, borders.w);
        d_inner = sdEllipse(v_FragCoord, innerHalfSize);
    }

    var alpha_outer = 1.0 - antialias(d_outer);
    var alpha_inner = 1.0 - antialias(d_inner);

    var color = mix(strokeColor, fillColor, alpha_inner);

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

fn sdEllipse(p: vec2f, r: vec2f  ) -> f32 {
    var k1 = length(p/r);
    return length(p)*(1.0-1.0/k1);
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