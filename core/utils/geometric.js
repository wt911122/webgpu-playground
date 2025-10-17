function dotProduct(v1, v2) {
    return v1[0] * v2[0] + v1[1] * v2[1];
}

function vectorLength(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

export function calculateAngle(v1, v2) {
    const dot = dotProduct(v1, v2);
    const length1 = vectorLength(v1);
    const length2 = vectorLength(v2);

    const cosTheta = dot / (length1 * length2);
    
    // 确保 cosTheta 的值在 [-1, 1] 的范围内，以避免 Math.acos 的错误
    const clampedCosTheta = Math.max(-1, Math.min(1, cosTheta));
    
    const angleInRadians = Math.acos(clampedCosTheta);
    // const angleInDegrees = angleInRadians * (180 / Math.PI); // 转换为度
    const crossProduct = v1[0] * v2[1] - v1[1] * v2[0];
    console.log(crossProduct< 0)
    if (crossProduct < 0) {
        return -angleInRadians;
    } 
    return angleInRadians;
}


export const PI_2 = Math.PI * 2;

export const RAD_TO_DEG = 180 / Math.PI;
export const DEG_TO_RAD = Math.PI / 180;