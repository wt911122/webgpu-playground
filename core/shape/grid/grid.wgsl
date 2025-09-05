struct SceneUniforms {
    u_ProjectionMatrix: mat3x3f,
    u_ViewMatrix: mat3x3f,
    u_ViewProjectionInvMatrix: mat3x3f,
    u_ZoomScale: f32,
    u_AspectRatio: f32,
}
@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms;

struct ShapeUniforms {
    zindexTop: f32,
}
@group(0) @binding(1) var<uniform> shapeUniforms: ShapeUniforms;

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
fn vs(vert: Vertex) -> VertexOut {
    var output: VertexOut;
    let zindexTop = shapeUniforms.zindexTop;
    output.position = vec4f(vert.vertexPos.xy, (zindexTop - 1)/zindexTop, 1);
    output.fragPosition = project_clipspace_to_world(vert.vertexPos);
    return output;
}

const GRID_COLOR = vec4f(0.87, 0.87, 0.87, 1.0);
const PAGE_COLOR = vec4f(0.986, 0.986, 0.986, 1.0);

fn render_grid(coord: vec2f) -> vec4f{
    var alpha: f32 = 0.0;
    var gridSize2 = 10.0;
    var grid2 = abs(fract(coord / gridSize2 - 0.5) - 0.5) / fwidth(coord) * gridSize2;
    var v2 = 1.0 - min(min(grid2.x, grid2.y), 1.0);
    alpha = v2;

    return mix(PAGE_COLOR, GRID_COLOR, alpha);
}


@fragment
fn fs(fragData: VertexOut) -> @location(0) vec4f {
    return render_grid(fragData.fragPosition);
}
