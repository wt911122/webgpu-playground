struct SceneUniforms {
    u_ProjectionMatrix: mat3x3f,
    u_ViewMatrix: mat3x3f,
    u_ViewProjectionInvMatrix: mat3x3f,
    u_ZoomScale: f32,
}
@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms;

fn project_clipspace_to_world(p: vec2f) -> vec2f{
  return (sceneUniforms.u_ViewProjectionInvMatrix * vec3f(p, 1)).xy;
}


struct Vertex {
   @location(0) vertexPos: vec2f,
};


struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) fragPosition: vec2f,
}

@vertex
fn main(vert: Vertex) -> VertexOut {
    var output: VertexOut;
    output.position = vec4f(vert.vertexPos.xy, 0, 1);
    output.fragPosition = project_clipspace_to_world(vert.vertexPos);
    return output;
}