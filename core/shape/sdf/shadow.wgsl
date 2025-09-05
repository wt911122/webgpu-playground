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
    size: vec2f,
    zindex: f32,
    strokeWidth: f32,
    borderRadius: f32,
    shapeType: f32,
    fill: vec4f,
    stroke: vec4f,
    shapeMatrix: mat3x3f,
    shadowBlur: f32,
    _unused: f32,
    shadowOffset: vec2f,
    shadowColor: vec4f,
};
@group(0) @binding(2) var<uniform> obj: PerObjectUniforms;

struct Vertex {
    @location(0) vertexPos: vec2f,
    // @location(14) abcd: vec4f,
    // @location(15) txty: vec2f,
};


struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) origin: vec2f,
  @location(1) size: vec2f,
  @location(2) fragPosition: vec2f,
}

@vertex
fn vs(
   vert: Vertex
) -> VertexOutput {

    var output : VertexOutput;
    var margin = 3.0 * obj.shadowBlur;
    var origin = obj.shadowOffset;
    var size = obj.size;
    var half_size = size/2;    
    let vertex = mix(
        - half_size - margin,
        half_size + margin,
        vert.vertexPos
    );
    var zindexTop = shapeUniforms.zindexTop;
    output.position = vec4f((gloabalUniforms.u_ProjectionMatrix
        * gloabalUniforms.u_ViewMatrix
        * obj.shapeMatrix
        * vec3f(vertex, 1)).xy, (zindexTop - obj.zindex - 1 + 0.1)/zindexTop, 1);
    output.fragPosition = vertex;
    return output;

}

const epsilon: f32 = 0.000001;
const PI: f32 = 3.1415926;
@fragment
fn fs(fragData: VertexOutput) -> @location(0) vec4f {
    let shadowColor = obj.shadowColor;
    let origin = obj.shadowOffset;
    let size = obj.size;
    let half_size = size/2;    
    let alpha = shadowColor.a * roundedBoxShadow(
        origin - half_size,
        origin + half_size,
        fragData.fragPosition,
        obj.shadowBlur,
        vec4f(obj.borderRadius, obj.borderRadius, obj.borderRadius, obj.borderRadius)
    );
    return vec4f(shadowColor.rgb, alpha);
}

fn gaussian(x: f32, sigma: f32) -> f32 {
    return exp(-(x * x) / (2. * sigma * sigma)) / (sqrt(2. * PI) * sigma);
}

fn erf(x: vec2f) -> vec2f {
    var s = sign(x);
    var a = abs(x);
    var t = 1.0 + (0.278393 + (0.230389 + 0.078108 * (a * a)) * a) * a;
    t *= t;
    return s - s / (t * t);
}

// Return the mask for the shadow of a box from lower to upper.
fn roundedBoxShadow(
    lower: vec2f,
    upper: vec2f,
    point: vec2f,
    sigma: f32,
    corners: vec4f
) -> f32 {
    // Center everything to make the math easier.
    let center = (lower + upper) * 0.5;
    let halfSize = (upper - lower) * 0.5;
    let p = point - center;

    // The signal is only non-zero in a limited range, so don't waste samples.
    let low = p.y - halfSize.y;
    let high = p.y + halfSize.y;
    let start = clamp(-3 * sigma, low, high);
    let end = clamp(3 * sigma, low, high);

    // Accumulate samples (we can get away with surprisingly few samples).
    let step = (end - start) / 4.0;
    var y = start + step * 0.5;
    var value: f32 = 0;

    for (var i = 0; i < 4; i++) {
        let corner = selectCorner(p.x, p.y, corners);
        value
            += roundedBoxShadowX(p.x, p.y - y, sigma, corner, halfSize)
            * gaussian(y, sigma) * step;
        y += step;
    }

    return value;
}

fn selectCorner(x: f32, y: f32, c: vec4f) -> f32 {
    return mix(mix(c.x, c.y, step(0, x)), mix(c.w, c.z, step(0, x)), step(0, y));
}

fn roundedBoxShadowX(x: f32, y: f32, s: f32, corner: f32, halfSize: vec2f) -> f32 {
    let d = min(halfSize.y - corner - abs(y), 0);
    let c = halfSize.x - corner + sqrt(max(0, corner * corner - d * d));
    let integral = 0.5 + 0.5 * erf((x + vec2f(-c, c)) * (sqrt(0.5) / s));
    return integral.y - integral.x;
}

fn normalizeColor(color: vec4f) -> vec4f {
  return vec4f(color.rgb * color.a / 255, color.a);
}