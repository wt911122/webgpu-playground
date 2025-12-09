const pos = array(vec2f(0, 1), vec2f(1, 1), vec2f(0, 0), vec2f(1, 0));

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
    fontSize: f32,
    fill: vec4f,
    shapeMatrix: mat3x3f,
}
@group(0) @binding(2) var<uniform> obj: PerObjectUniforms;


struct Char {
  texOffset: vec2f,
  texExtent: vec2f,
  size: vec2f,
  offset: vec2f,
  page: f32,
};

@group(1) @binding(0) var fontTexture: texture_2d_array<f32>;
@group(1) @binding(1) var fontSampler: sampler;
@group(1) @binding(2) var<storage> chars: array<Char>;

struct FormattedText {
  chars: array<vec3f>,
};
@group(2) @binding(0) var<storage> text: FormattedText;


struct VertexInput {
  @builtin(vertex_index) vertex : u32,
  @builtin(instance_index) instance : u32,
};

struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) texcoord : vec2f,
  @location(1) @interpolate(flat) page: f32,
};

@vertex
fn vs(
   input: VertexInput
) -> VertexOutput {

    let textElement = text.chars[input.instance];
    let char = chars[u32(textElement.z)];
    let charPos = (pos[input.vertex] * char.size + textElement.xy - char.offset * vec2f(-1, 1)) * obj.fontSize;


    var output : VertexOutput;
    var zindexTop = shapeUniforms.zindexTop;
    output.position = vec4f((gloabalUniforms.u_ProjectionMatrix
        * gloabalUniforms.u_ViewMatrix
        * obj.shapeMatrix
        * vec3f(charPos, 1)).xy, (zindexTop - obj.zindex - 1)/zindexTop, 1);
    
    output.texcoord = pos[input.vertex];// * vec2f(1, -1);
    output.texcoord *= char.texExtent;
    output.texcoord += char.texOffset;
    output.page = char.page;
    return output;
}

fn sampleMsdf(texcoord: vec2f, page: f32) -> f32 {
    let c = textureSample(fontTexture, fontSampler, texcoord, u32(page));
    return max(min(c.r, c.g), min(max(c.r, c.g), c.b));
}


@fragment
fn fs(input : VertexOutput) -> @location(0) vec4f {
    // let pxRange = 4.0;
    // let sz = vec2f(textureDimensions(fontTexture, 0));
    // let dx = sz.x*length(vec2f(dpdxFine(input.texcoord.x), dpdyFine(input.texcoord.x)));
    // let dy = sz.y*length(vec2f(dpdxFine(input.texcoord.y), dpdyFine(input.texcoord.y)));
    // let toPixels = pxRange * inverseSqrt(dx * dx + dy * dy);
    let sigDist = sampleMsdf(input.texcoord, input.page) - 0.5;
    // let pxDist = sigDist * toPixels;
   
    var fillColor = vec4f(obj.fill.rgb*obj.fill.a/255, obj.fill.a);
    // let edgeWidth = 0.1;

    // let alpha = smoothstep(-edgeWidth, edgeWidth, pxDist);
    var alpha = clamp(sigDist/fwidth(sigDist) + 0.5, 0.0, 1.0);
    if (alpha < 0.001) {
        discard;
    }

    return vec4f(fillColor.rgb, fillColor.a * alpha);
}