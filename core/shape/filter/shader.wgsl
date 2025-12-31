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
    opacity: f32,
    size: vec2f,
    expand: vec2f,
    shapeMatrix: mat3x3f,
};
@group(0) @binding(2) var<uniform> obj: PerObjectUniforms;

@group(1) @binding(0) var textureSource: texture_2d<f32>;
@group(1) @binding(1) var textureSampler: sampler;

struct VertexIn {
    @builtin(vertex_index) vertexIndex : u32,
    @location(0) vertexPos: vec2f,
    @location(1) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(1) vUV: vec2f,
}

@vertex
fn vs(
   vert: VertexIn
) -> VertexOutput {
    var size = obj.size;
    var expand = obj.expand;
    let position = mix(
         - expand,
        size + expand,
        (vert.vertexPos)
    );


    // var position = (obj.size / 2.0) * (vert.vertexPos + vec2f(1,1)) ; 
    // let pos = array(
    //     vec2f( 0,  200),  // top center
    //     vec2f(200, 200),  // bottom left
    //     vec2f(0, 0),   // bottom right
    //     vec2f( 0,  0),  // top center
    //     vec2f(200, 200),  // bottom left
    //     vec2f(200, 0)   // bottom right
    // );
    // let mtx = mat3x3(
    //     vec3f(1, 0, 0),
    //     vec3f(0, 1, 0),
    //     vec3f(0, 0, 1),
    // )
    var output:VertexOutput;
    var zindexTop = shapeUniforms.zindexTop;
    output.position = vec4f((gloabalUniforms.u_ProjectionMatrix
        * gloabalUniforms.u_ViewMatrix
        * obj.shapeMatrix
        * vec3f(position, 1)).xy, (zindexTop - obj.zindex - 1)/zindexTop, 1);
    output.vUV = vert.uv;

    // let pos = array(
    //     vec2f( 0,  1),  // top center
    //     vec2f(1, 1),  // bottom left
    //     vec2f(0, 0),   // bottom right
    //     vec2f( 0,  0),  // top center
    //     vec2f(1, 1),  // bottom left
    //     vec2f(1, 0)   // bottom right
    // );
    // output.position = vec4f(pos[vert.vertexIndex], (zindexTop - obj.zindex - 1)/zindexTop, 1.0);

    return output;
}


@fragment
fn fs(fragData: VertexOutput) -> @location(0) vec4f {
    var color = textureSample(textureSource, textureSampler, fragData.vUV);

    return color * obj.opacity;
}
