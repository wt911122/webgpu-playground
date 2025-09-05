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
    zindex: f32,
    strokeWidth: f32,
    pos: vec2f,
    stroke: vec4f,
    shapeMatrix: mat3x3f,
};
@group(0) @binding(2) var<uniform> obj: PerObjectUniforms;

struct Vertex {
    @location(0) vertexPos: vec2f,
};


struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) fragPosition: vec2f,
  @location(1) radius: f32,
}

@vertex
fn vs(
   vert: Vertex
) -> VertexOutput {
    var output : VertexOutput;
    var size = 20.0;
    output.radius = size;
    var position = obj.pos + size * vert.vertexPos;
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

const epsilon: f32 = 0.000001;
@fragment
fn fs(fragData: VertexOutput) -> @location(0) vec4f {
    let v_Radius = fragData.radius;
    let v_FragCoord = fragData.fragPosition;
    let fillColor = obj.stroke;

    let distance = sdCircle(v_FragCoord, v_Radius);
    
    var outputColor = fillColor;


    // let antialiasedBlur = -fwidth(length(v_FragCoord));
    // let opacity_t = clamp(distance / antialiasedBlur, 0.0, 1.0);
    // outputColor *= clamp(1.0 - distance, 0.0, 1.0) * opacity_t;
    // if (outputColor.a < epsilon) {
    //     discard;
    // }
    return outputColor;
}


fn sdCircle(p: vec2f, r: f32) -> f32 {
    return length(p) - r;
}