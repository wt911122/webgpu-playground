fn sdCircle(p: vec2f, r: f32) -> f32 {
  return length(p) - r;
}

struct FragmentInput {
    @location(0) fragPosition: vec2f,
}

@fragment
fn main(fragData: FragmentInput) -> @location(0) vec4f {
    var distance = sdCircle(fragData.fragPosition, 1.0);
    if (distance > 0.0) {
        discard;
    }
    var alpha = clamp(-distance / fwidth(-distance), 0.0, 1.0);
    return vec4f(1.0, 0.0, 0.0, alpha);
}