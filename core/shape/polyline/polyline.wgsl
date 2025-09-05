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
    fill: vec4f,
    stroke: vec4f,
    shapeMatrix: mat3x3f,
};
@group(0) @binding(2) var<uniform> obj: PerObjectUniforms;

struct Vertex {
    @location(0) vertexPos: vec2f,
    @location(1) pointA: vec2f,
    @location(2) pointB: vec2f,
};


struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) fragPosition: vec2f,
}

@vertex
fn vs(
   vert: Vertex
) -> VertexOutput {
    var output: VertexOutput;
    let zindexTop = shapeUniforms.zindexTop;
    let xBasis = vert.pointB - vert.pointA;
    let yBasis = normalize(vec2f(-xBasis.y, xBasis.x));
    let position = vert.pointA 
        + xBasis * vert.vertexPos.x 
        + yBasis * obj.strokeWidth * vert.vertexPos.y;

    output.position = vec4f((gloabalUniforms.u_ProjectionMatrix
        * gloabalUniforms.u_ViewMatrix
        * obj.shapeMatrix
        * vec3f(position, 1)).xy, (zindexTop - obj.zindex - 1)/zindexTop, 1);
    output.fragPosition = position;
    return output;
}

@fragment
fn fs(fragData: VertexOutput) -> @location(0) vec4f {
    return obj.stroke;
}