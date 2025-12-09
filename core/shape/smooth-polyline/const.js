export const JOINT_TYPE = {
    NONE : 0,
    FILL : 1,
    JOINT_BEVEL : 4,
    JOINT_MITER : 8,
    JOINT_ROUND : 12,
    JOINT_CAP_BUTT : 16,
    JOINT_CAP_SQUARE : 18,
    JOINT_CAP_ROUND : 20,
    FILL_EXPAND : 24,
    CAP_BUTT : 1 << 5,
    CAP_SQUARE : 2 << 5,
    CAP_ROUND : 3 << 5,
    CAP_BUTT2 : 4 << 5,
}



const verts = [];

for (let i = 0; i < 256; i++)
{ verts.push(0); }
// simple fill
verts[JOINT_TYPE.FILL] = 1;

for (let i = 0; i < 8; i++)
{
    verts[JOINT_TYPE.FILL_EXPAND + i] = 3;
}

// no caps for now
verts[JOINT_TYPE.JOINT_BEVEL] = 4 + 5;
verts[JOINT_TYPE.JOINT_BEVEL + 1] = 4 + 5;
verts[JOINT_TYPE.JOINT_BEVEL + 2] = 4 + 5;
verts[JOINT_TYPE.JOINT_BEVEL + 3] = 4 + 5;
verts[JOINT_TYPE.JOINT_ROUND] = 4 + 5;
verts[JOINT_TYPE.JOINT_ROUND + 1] = 4 + 5;
verts[JOINT_TYPE.JOINT_ROUND + 2] = 4 + 5;
verts[JOINT_TYPE.JOINT_ROUND + 3] = 4 + 5;
verts[JOINT_TYPE.JOINT_MITER] = 4 + 5;
verts[JOINT_TYPE.JOINT_MITER + 1] = 4 + 5;
verts[JOINT_TYPE.JOINT_MITER + 2] = 4;
verts[JOINT_TYPE.JOINT_MITER + 3] = 4;
verts[JOINT_TYPE.JOINT_CAP_BUTT] = 4;
verts[JOINT_TYPE.JOINT_CAP_BUTT + 1] = 4;
verts[JOINT_TYPE.JOINT_CAP_SQUARE] = 4;
verts[JOINT_TYPE.JOINT_CAP_SQUARE + 1] = 4;
verts[JOINT_TYPE.JOINT_CAP_ROUND] = 4 + 5;
verts[JOINT_TYPE.JOINT_CAP_ROUND + 1] = 4 + 5;

verts[JOINT_TYPE.CAP_ROUND] = 4;


export const VertsByJoint = verts;