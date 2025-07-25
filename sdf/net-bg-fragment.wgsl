struct SceneUniforms {
    u_ProjectionMatrix: mat3x3f,
    u_ViewMatrix: mat3x3f,
    u_ViewProjectionInvMatrix: mat3x3f,
    u_ZoomScale: f32,
}
@group(0) @binding(0) var<uniform> sceneUniforms: SceneUniforms;

const GRID_COLOR = vec4f(0.87, 0.87, 0.87, 1.0);
const PAGE_COLOR = vec4f(0.986, 0.986, 0.986, 1.0);
const BASE_GRID_PIXEL_SIZE = 100.0;

fn scale_grid_size(zoom: f32) -> vec2f {
//   if (zoom < 0.125) {
//     return vec2f(BASE_GRID_PIXEL_SIZE * 125.0, 0.125);
//   } else if (zoom < 0.25) {
//     return vec2f(BASE_GRID_PIXEL_SIZE * 25.0, 0.25);
//   } else if (zoom < 0.5) {
//     return vec2f(BASE_GRID_PIXEL_SIZE * 5.0, 0.5);
//   }
  return vec2f(BASE_GRID_PIXEL_SIZE, 4.0);
}

// grid

fn render_grid(coord: vec2f) -> vec4f{
    var alpha: f32 = 0.0;
    // var size = scale_grid_size(sceneUniforms.u_ZoomScale);
    // var gridSize1 = size.x;
    var gridSize2 = 10.0;//gridSize1 / 10.0;
    // var zoomStep = size.y;

    // var grid1 = abs(fract(coord / gridSize1 - 0.5) - 0.5) / fwidth(coord) * gridSize1 / 2.0;
    var grid2 = abs(fract(coord / gridSize2 - 0.5) - 0.5) / fwidth(coord) * gridSize2;
    // var v1 = 1.0 - min(min(grid1.x, grid1.y), 1.0);
    var v2 = 1.0 - min(min(grid2.x, grid2.y), 1.0);
    alpha = v2;
    // if (v1 > 0.0) {
    //   alpha = v1;
    // } else {
    //   alpha = v2 * clamp(sceneUniforms.u_ZoomScale / zoomStep, 0.0, 1.0);
    // }

    return mix(PAGE_COLOR, GRID_COLOR, alpha);
    // return PAGE_COLOR;
}

// grid
const BASE_DOT_SIZE = 3.0;
fn render_dot_grid(coord: vec2f) -> vec4f{
    var alpha: f32 = 0.0;
    var size = scale_grid_size(sceneUniforms.u_ZoomScale);
    var gridSize1 = size.x;
    var gridSize2 = gridSize1 / 10.0;
    var zoomStep = size.y;
 
    var grid2 = abs(fract(coord / gridSize2 - 0.5) - 0.5) / fwidth(coord) * gridSize2;
    alpha = 1.0 - smoothstep(0.0, 1.0, length(grid2) - BASE_DOT_SIZE * sceneUniforms.u_ZoomScale / zoomStep);

    return mix(PAGE_COLOR, GRID_COLOR, alpha);
    // return PAGE_COLOR;
}

struct FragmentInput {
    @location(0) fragPosition: vec2f,
}

@fragment
fn main(fragData: FragmentInput) -> @location(0) vec4f {
    // return vec4f(0.0, 0.0, 1.0, 1.0);
    // return render_dot_grid(fragData.fragPosition);
    return render_grid(fragData.fragPosition);
}
