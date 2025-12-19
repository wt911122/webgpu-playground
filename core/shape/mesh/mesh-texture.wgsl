
struct PerObjectUniforms {
    opacity: f32,
    useTexture: f32,
    box: vec4f,
    fill: vec4f,
};
@group(0) @binding(0) var<uniform> obj: PerObjectUniforms;

@group(1) @binding(0) var textureSource: texture_2d<f32>;
@group(1) @binding(1) var textureSampler: sampler;

struct Vertex {
    @builtin(vertex_index) vertexIndex: u32,
    @location(0) vertexPos: vec2f
};


struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) texcoord: vec2f
};

@vertex
fn vs(
   vert: Vertex
) -> VertexOutput {
    var output : VertexOutput;
    var box = obj.box;
    var position = vert.vertexPos - box.xy;
    var size = box.zw - box.xy;
    output.position = vec4f(position/size*2-1, 0.0, 1.0);
    output.texcoord = position/size;
    // let pos = array(
    //     // 1st triangle
    //     vec2f( 0.0,  0.0),  // center
    //     vec2f( 1.0,  0.0),  // right, center
    //     vec2f( 0.0,  1.0),  // center, top

    //     // 2st triangle
    //     vec2f( 0.0,  1.0),  // center, top
    //     vec2f( 1.0,  0.0),  // right, center
    //     vec2f( 1.0,  1.0),  // right, top
    // );
    // let xy = pos[vert.vertexIndex];
    // output.position = vec4f(xy, 0.0, 1.0);
    return output;
}

@fragment
fn fs(fragData: VertexOutput) -> @location(0) vec4f {
    var fillColor: vec4f;
    if(obj.useTexture > 0) {
        fillColor = textureSample(textureSource, textureSampler, fragData.texcoord);
    } else {
        fillColor = vec4f(obj.fill.rgb*obj.fill.a/255, obj.fill.a);
    }
    return fillColor;
}
