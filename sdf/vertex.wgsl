
struct SceneUniforms {
  u_Resolution: vec2f,
}
@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms;

struct Vertex {
    @location(0) vertexPos: vec2f,
    @location(1) pos: vec2f,
    @location(2) radius: f32,
};


struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) fragPosition: vec2f,
}

@vertex
fn main(
   vert: Vertex
) -> VertexOutput {
    var output : VertexOutput;
    var position = vert.pos + vert.radius * vert.vertexPos;
    var zeroToOne = position / sceneUniforms.u_Resolution;
    var zeroToTwo = zeroToOne * 2.0;
    var clipSpace = zeroToTwo - 1.0;
    output.position = vec4f(clipSpace * vec2(1, -1), 0.0, 1.0);
    // output.position = vec4f(zeroToOne, 0.0, 1.0);
    output.fragPosition = vert.vertexPos;
    return output;
}