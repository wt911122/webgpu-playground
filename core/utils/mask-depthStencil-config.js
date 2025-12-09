export const MASK_BEGIN_DEPTH_STENCIL_CONFIG = {
    stencilFront: {
        compare: "equal",
        passOp: "increment-clamp"
    },
    stencilBack: {
        compare: "equal",
        passOp: "increment-clamp"
    },
    format: "depth24plus-stencil8",
    depthWriteEnabled: false,
    depthCompare: "always"
}

export const MASK_END_DEPTH_STENCIL_CONFIG = {
    stencilFront: {
        compare: "equal",
        passOp: "decrement-clamp"
    },
    stencilBack: {
        compare: "equal",
        passOp: "decrement-clamp"
    },
    format: "depth24plus-stencil8",
    depthWriteEnabled: false,
    depthCompare: "always"
}

export const GENERAL_DEPTH_STENCIL_CONFIG = {
    stencilWriteMask: 0,
    stencilFront: {
        compare: "equal",
        passOp: "keep"
    },
    stencilBack: {
        compare: "equal",
        passOp: "keep"
    },
    format: "depth24plus-stencil8",
    depthWriteEnabled: true,
    depthCompare: "less"
}