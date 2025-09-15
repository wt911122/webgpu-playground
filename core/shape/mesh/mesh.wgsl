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
    fill: vec4f,
    shapeMatrix: mat3x3f,
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
    var position = vert.vertexPos;
    var zindexTop = shapeUniforms.zindexTop;
    output.position = vec4f((gloabalUniforms.u_ProjectionMatrix
        * gloabalUniforms.u_ViewMatrix
        * obj.shapeMatrix
        * vec3f(position, 1)).xy, (zindexTop - obj.zindex - 1)/zindexTop, 1);
    output.fragPosition = position;
    return output;
}

@fragment
fn fs(fragData: VertexOutput) -> @location(0) vec4f {
    var fillColor = vec4f(obj.fill.rgb*obj.fill.a/255, obj.fill.a);
    return fillColor;
}
