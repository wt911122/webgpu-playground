import { mat3, vec2 } from 'gl-matrix';

export class TransformMatrix {
    _matrix = mat3.create();

    translate(x, y) {
        const mat = this._matrix;
        mat3.translate(mat, mat, vec2.fromValues(x, y))
    }

    rotate(angle) {
        const mat = this._matrix;
        mat3.rotate(mat, mat, angle)
    }

    scale(a, b) {
        const mat = this._matrix;
        mat3.scale(mat, mat, vec2.fromValues(a, b))
    }

    getMatrix() {
        return this._matrix;
    }
}

export class MatrixStack {
    _stack = [];

    init() {
        this._stack.push(mat3.create());
    }

    getTransform() {
        return this._stack[this._stack.length-1];
    }

    transform(mat) {
        const s = this._stack;
        const cmat = s[s.length-1];
        const nmat = mat3.create();
        mat3.multiply(nmat, cmat, mat);
        this._stack.push(nmat);
    }

    restore(){
        this._stack.pop();
        if (this.length < 1) {
            this[0] = mat3.create();
        }
    }
}

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
