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
    fill: vec4f,
    stroke: vec4f,
    shapeMatrix: mat3x3f,
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
}

@vertex
fn vs(
   vert: Vertex
) -> VertexOutput {
    var output : VertexOutput;
    var radius = obj.size/2 + vec2(obj.strokeWidth / 2.0);
    var position = radius * vert.vertexPos;
    /*
     * zindex的计算会影响堆叠顺序，然后对fragment中 color bland结果产生影响，具体原理不太清楚
     */
    var zindexTop = shapeUniforms.zindexTop;
    output.position = vec4f((gloabalUniforms.u_ProjectionMatrix
        * gloabalUniforms.u_ViewMatrix
        * obj.shapeMatrix
        * vec3f(position, 1)).xy, (zindexTop - obj.zindex - 1)/zindexTop, 1);
    output.fragPosition = vert.vertexPos;
    return output;
}

fn sdCircle(p: vec2f, r: f32) -> f32 {
  return length(p) - r;
}


@fragment
fn fs(fragData: VertexOutput) -> @location(0) vec4f {
    var distance = sdCircle(fragData.fragPosition, 1.0);
    if (distance > 0.0) {
        discard;
    }
    var alpha = clamp(-distance / fwidth(-distance), 0.0, 1.0);
    var fill = obj.fill; 
    // var alpha = clamp(-distance / fwidth(-distance), 0.0, 1.0);
    // if(alpha < 0.001) {
    //     discard;
    // }
    return vec4f(fill.rgb/255, fill.a * alpha); // fill.a * alpha);
}