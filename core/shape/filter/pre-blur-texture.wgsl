struct BlurParams {
    blur: vec2f,
    size: vec2f
}

@group(0) @binding(0) var ourSampler: sampler;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> params: BlurParams;

struct OurVertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) texcoord: vec2f,
};

const pos = array(
    vec2f( -1.0,  -1.0),  // center
    vec2f( 1.0,  -1.0),  // right, center
    vec2f( -1.0,  1.0),  // center, top

    // 2st triangle
    vec2f( -1.0,  1.0),  // center, top
    vec2f( 1.0,  -1.0),  // right, center
    vec2f( 1.0,  1.0),  // right, top
);
const uv = array(
    vec2f( 0.0,  1.0),  // center
    vec2f( 1.0,  1.0),  // right, center
    vec2f( 0.0,  0.0),  // center, top

    // 2st triangle
    vec2f( 0.0,  0.0),  // center, top
    vec2f( 1.0,  1.0),  // right, center
    vec2f( 1.0,  0.0),  // right, top
);

@vertex fn vs(
    @builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {

    var blur = params.blur;
    var size = params.size;
    var half_size = size/2;    

    var margin = blur/half_size;
    let vertex = mix(
        vec2f(-1.0, -1.0) + margin,
        vec2f(1.0, 1.0) - margin,
        (pos[vertexIndex] + vec2f(1, 1))/2
    );

    var vsOutput: OurVertexShaderOutput;
    vsOutput.position =  vec4f(vertex, 0.0, 1.0);
    vsOutput.texcoord = uv[vertexIndex];
    return vsOutput;
}


@fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
    return textureSample(ourTexture, ourSampler, fsInput.texcoord);
}