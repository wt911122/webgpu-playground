import { mat3, vec2 } from 'gl-matrix';

export function paddingMat3(matrix) {
    return [
        matrix[0],
        matrix[1],
        matrix[2],
        0,
        matrix[3],
        matrix[4],
        matrix[5],
        0,
        matrix[6],
        matrix[7],
        matrix[8],
        0,
    ];
}

export function copyMat3(out, mat) {
    out[0] = mat[0];
    out[1] = mat[1];
    out[2] = mat[2];
    out[3] = mat[3];
    out[4] = mat[4];
    out[5] = mat[5];
    out[6] = mat[6];
    out[7] = mat[7];
    out[8] = mat[8];
    out[9] = mat[9];
    out[10] = mat[10];
    out[11] = mat[11];
}

function dotProduct(v1, v2) {
    return v1[0] * v2[0] + v1[1] * v2[1];
}
export function projectVector(out, a, unitB) {
    // 计算投影
    const dot = dotProduct(a, unitB);
    out[0] = dot * unitB[0];
    out[1] = dot * unitB[1];
}


export function updateLocalTransform(params) {
    const { _position, _scale, _pivot, _origin, _rotation } = params;
    const { _localTransform } = params;
    
    // 将角度转换为弧度
    const rad = _rotation;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // 组合变换矩阵
    // 变换顺序: 平移到origin -> 平移pivot -> 缩放 -> skew -> 旋转 -> 平移-pivot -> 平移-origin -> 平移position
    
    // 计算最终的变换矩阵元素
    const a = cos * _scale[0];
    const b = sin * _scale[0];
    const c = -sin * _scale[1];
    const d = cos * _scale[1];
    
    // 添加skewX
    const finalA = a;
    const finalB = b;
    const finalC = c;
    const finalD = d;
    
    // 计算平移部分
    const pivotX = _pivot[0] + _origin[0];
    const pivotY = _pivot[1] + _origin[1];
    
    const tx = _position[0] - _origin[0] - (finalA * pivotX + finalC * pivotY - pivotX);
    const ty = _position[1] - _origin[1] - (finalB * pivotX + finalD * pivotY - pivotY);
    
    // 设置矩阵 (列主序)
    mat3.set(_localTransform,
        finalA, finalB, 0,
        finalC, finalD, 0,
        tx, ty, 1
    );
    
    return _localTransform;
}

// 从变换矩阵分解得到变换参数
export function decomposeLocalTransform(params) {
    const { _localTransform } = params;
    
    // 提取矩阵元素 (列主序)
    const a = _localTransform[0];
    const b = _localTransform[1];
    const c = _localTransform[3];
    const d = _localTransform[4];
    const tx = _localTransform[6];
    const ty = _localTransform[7];
    
    // 分解矩阵
    // 计算缩放和旋转
    const scaleX = Math.sqrt(a * a + b * b);
    const scaleY = Math.sqrt(c * c + d * d);
    
    // 计算旋转角度
    let rotation = Math.atan2(b, a);
    
    // 归一化方向
    const signX = scaleX !== 0 ? 1 : 1;
    const signY = scaleY !== 0 ? (a * d - b * c < 0 ? -1 : 1) : 1;
    
    const finalScaleX = scaleX * signX;
    const finalScaleY = scaleY * signY;
    
    // 设置结果 (假设origin和pivot保持不变，只更新position)
    vec2.set(params._scale, finalScaleX, finalScaleY);
    params._rotation = rotation;
    
    // 计算position (考虑pivot和origin)
    const pivotX = params._pivot[0] + params._origin[0];
    const pivotY = params._pivot[1] + params._origin[1];
    
    const posX = tx + params._origin[0] + (a * pivotX + c * pivotY - pivotX);
    const posY = ty + params._origin[1] + (b * pivotX + d * pivotY - pivotY);
    
    vec2.set(params._position, posX, posY);
    
    return params;
}