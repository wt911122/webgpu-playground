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
    size: vec2f,
    zindex: f32,
    strokeWidth: f32,
    borderRadius: f32,
    shapeType: f32,
    useLineDash: f32,
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
    // @location(14) abcd: vec4f,
    // @location(15) txty: vec2f,
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
    var size = obj.size/2;
    var radius = size; //+ vec2(obj.strokeWidth/2);
    output.radius = radius;
    var position = size * vert.vertexPos;
    /*
     * zindex的计算会影响堆叠顺序，然后对fragment中 color bland结果产生影响，具体原理不太清楚
     */
    var zindexTop = shapeUniforms.zindexTop;
    output.position = vec4f((gloabalUniforms.u_ProjectionMatrix
        * gloabalUniforms.u_ViewMatrix
        * obj.shapeMatrix
        * vec3f(position, 1)).xy, (zindexTop - obj.zindex - 1)/zindexTop, 1);
    output.fragPosition = position;
    return output;
}

fn normalizeColor(color: vec4f) -> vec4f {
  return vec4f(color.rgb * color.a / 255, color.a);
}

const epsilon: f32 = 0.000001;
@fragment
fn fs(fragData: VertexOutput) -> @location(0) vec4f {
    var v_Radius = fragData.radius;
    var v_FragCoord = fragData.fragPosition;
    var strokeWidth = obj.strokeWidth;
    var borderRadius = obj.borderRadius;
    var fillColor = vec4f(obj.fill.rgb*obj.fill.a/255, obj.fill.a);
    var strokeColor = (obj.stroke);
    var shapeType = obj.shapeType;
    var useLineDash = obj.useLineDash;

    var distance: f32;
    if(shapeType < 0.5) {
        distance = sdEllipse(v_FragCoord, v_Radius);
    } else if(shapeType < 1.5) {
        distance = sdRectangle(v_FragCoord, v_Radius, borderRadius);
    }
    if (distance > 0.0) {
        discard;
    }
    
    var color = fillColor;
    if (strokeWidth > 0.0 && useLineDash < 2) {
        color = mix_border_inside(over(fillColor, strokeColor), fillColor, distance + strokeWidth);
        color = mix_border_inside(strokeColor, color, distance + strokeWidth / 2.0);
    }
    var outputColor = color;


    /* var antialiasedBlur = -fwidth(length(v_FragCoord));
    var opacity_t = clamp(distance / antialiasedBlur, 0.0, 1.0);
    outputColor *= clamp(1.0 - distance, 0.0, 1.0) * opacity_t;
    if (outputColor.a < epsilon) {
        discard;
    }*/
    return outputColor;
}


fn sdCircle(p: vec2f, r: f32) -> f32 {
    return length(p) - r;
}
fn sdEllipse(p: vec2f, r: vec2f) -> f32 {
  var k1 = length(p/r);
  return length(p)*(1.0-1.0/k1);
}

fn sdRectangle(p: vec2f, b: vec2f, r: f32) -> f32 {
  var q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0, 0.0))) - r;
}

fn over(below: vec4f, above: vec4f) -> vec4f {
  var alpha = above.a + below.a * (1.0 - above.a);
  var rgb = (above.rgb * above.a + below.rgb * below.a * (1.0 - above.a)) / alpha;
  return vec4f(rgb,  alpha);
}

fn antialias(distance: f32) -> f32 {
  return clamp(distance / -fwidth(distance), 0.0, 1.0);
}

fn mix_border_inside(border: vec4f, inside: vec4f, distance: f32) -> vec4f{
  // Blend the border on top of the background and then linearly interpolate
  // between the two as we slide inside the background.
  return mix(border, inside, clamp(1.0 - distance, 0.0, 1.0) * antialias(distance));
}
