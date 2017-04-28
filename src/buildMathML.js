/**
 * This file converts a parse tree into a cooresponding MathML tree. The main
 * entry point is the `buildMathML` function, which takes a parse tree from the
 * parser.
 */

const buildCommon = require("./buildCommon");
const fontMetrics = require("./fontMetrics");
const mathMLTree = require("./mathMLTree");
const ParseError = require("./ParseError");
const symbols = require("./symbols");
const utils = require("./utils");

const makeSpan = buildCommon.makeSpan;
const fontMap = buildCommon.fontMap;

/**
 * Takes a symbol and converts it into a MathML text node after performing
 * optional replacement from symbols.js.
 */
const makeText = function(text, mode) {
    if (symbols[mode][text] && symbols[mode][text].replace) {
        text = symbols[mode][text].replace;
    }

    return new mathMLTree.TextNode(text);
};

/**
 * Returns the math variant as a string or null if none is required.
 */
const getVariant = function(group, options) {
    const font = options.font;
    if (!font) {
        return null;
    }

    const mode = group.mode;
    if (font === "mathit") {
        return "italic";
    }

    let value = group.value;
    if (utils.contains(["\\imath", "\\jmath"], value)) {
        return null;
    }

    if (symbols[mode][value] && symbols[mode][value].replace) {
        value = symbols[mode][value].replace;
    }

    const fontName = fontMap[font].fontName;
    if (fontMetrics.getCharacterMetrics(value, fontName)) {
        return fontMap[options.font].variant;
    }

    return null;
};

/**
 * Functions for handling the different types of groups found in the parse
 * tree. Each function should take a parse group and return a MathML node.
 */
const groupTypes = {};

groupTypes.mathord = function(group, options) {
    const node = new mathMLTree.MathNode(
        "mi",
        [makeText(group.value, group.mode)]);

    const variant = getVariant(group, options);
    if (variant) {
        node.setAttribute("mathvariant", variant);
    }
    return node;
};

groupTypes.textord = function(group, options) {
    const text = makeText(group.value, group.mode);

    const variant = getVariant(group, options) || "normal";

    let node;
    if (group.mode === 'text') {
        node = new mathMLTree.MathNode("mtext", [text]);
    } else if (/[0-9]/.test(group.value)) {
        // TODO(kevinb) merge adjacent <mn> nodes
        // do it as a post processing step
        node = new mathMLTree.MathNode("mn", [text]);
    } else {
        node = new mathMLTree.MathNode("mi", [text]);
    }
    if (options.font) {
        node.setAttribute("mathvariant", variant);
    }

    return node;
};

groupTypes.bin = function(group) {
    const node = new mathMLTree.MathNode(
        "mo", [makeText(group.value, group.mode)]);

    return node;
};

groupTypes.rel = function(group) {
    const node = new mathMLTree.MathNode(
        "mo", [makeText(group.value, group.mode)]);

    return node;
};

groupTypes.open = function(group) {
    const node = new mathMLTree.MathNode(
        "mo", [makeText(group.value, group.mode)]);

    return node;
};

groupTypes.close = function(group) {
    const node = new mathMLTree.MathNode(
        "mo", [makeText(group.value, group.mode)]);

    return node;
};

groupTypes.inner = function(group) {
    const node = new mathMLTree.MathNode(
        "mo", [makeText(group.value, group.mode)]);

    return node;
};

groupTypes.punct = function(group) {
    const node = new mathMLTree.MathNode(
        "mo", [makeText(group.value, group.mode)]);

    node.setAttribute("separator", "true");

    return node;
};

groupTypes.ordgroup = function(group, options) {
    const inner = buildExpression(group.value, options);

    const node = new mathMLTree.MathNode("mrow", inner);

    return node;
};

groupTypes.text = function(group, options) {
    const body = group.value.body;
    const inner = [];
    let currentText = null;
    for (let i = 0; i < body.length; i++) {
        const group = buildGroup(body[i], options);
        if (group.type === 'mtext' && currentText != null) {
            Array.prototype.push.apply(currentText.children, group.children);
        } else {
            inner.push(group);
            if (group.type === 'mtext') {
                currentText = group;
            }
        }
    }
    if (inner.length === 1) {
        return inner[0];
    } else {
        return new mathMLTree.MathNode("mrow", inner);
    }
};

groupTypes.color = function(group, options) {
    const inner = buildExpression(group.value.value, options);

    const node = new mathMLTree.MathNode("mstyle", inner);

    node.setAttribute("mathcolor", group.value.color);

    return node;
};

groupTypes.supsub = function(group, options) {
    const children = [buildGroup(group.value.base, options)];

    if (group.value.sub) {
        children.push(buildGroup(group.value.sub, options));
    }

    if (group.value.sup) {
        children.push(buildGroup(group.value.sup, options));
    }

    let nodeType;
    if (!group.value.sub) {
        nodeType = "msup";
    } else if (!group.value.sup) {
        nodeType = "msub";
    } else {
        nodeType = "msubsup";
    }

    const node = new mathMLTree.MathNode(nodeType, children);

    return node;
};

groupTypes.genfrac = function(group, options) {
    const node = new mathMLTree.MathNode(
        "mfrac",
        [
            buildGroup(group.value.numer, options),
            buildGroup(group.value.denom, options),
        ]);

    if (!group.value.hasBarLine) {
        node.setAttribute("linethickness", "0px");
    }

    if (group.value.leftDelim != null || group.value.rightDelim != null) {
        const withDelims = [];

        if (group.value.leftDelim != null) {
            const leftOp = new mathMLTree.MathNode(
                "mo", [new mathMLTree.TextNode(group.value.leftDelim)]);

            leftOp.setAttribute("fence", "true");

            withDelims.push(leftOp);
        }

        withDelims.push(node);

        if (group.value.rightDelim != null) {
            const rightOp = new mathMLTree.MathNode(
                "mo", [new mathMLTree.TextNode(group.value.rightDelim)]);

            rightOp.setAttribute("fence", "true");

            withDelims.push(rightOp);
        }

        const outerNode = new mathMLTree.MathNode("mrow", withDelims);

        return outerNode;
    }

    return node;
};

groupTypes.array = function(group, options) {
    return new mathMLTree.MathNode(
        "mtable", group.value.body.map(function(row) {
            return new mathMLTree.MathNode(
                "mtr", row.map(function(cell) {
                    return new mathMLTree.MathNode(
                        "mtd", [buildGroup(cell, options)]);
                }));
        }));
};

groupTypes.sqrt = function(group, options) {
    let node;
    if (group.value.index) {
        node = new mathMLTree.MathNode(
            "mroot", [
                buildGroup(group.value.body, options),
                buildGroup(group.value.index, options),
            ]);
    } else {
        node = new mathMLTree.MathNode(
            "msqrt", [buildGroup(group.value.body, options)]);
    }

    return node;
};

groupTypes.leftright = function(group, options) {
    const inner = buildExpression(group.value.body, options);

    if (group.value.left !== ".") {
        const leftNode = new mathMLTree.MathNode(
            "mo", [makeText(group.value.left, group.mode)]);

        leftNode.setAttribute("fence", "true");

        inner.unshift(leftNode);
    }

    if (group.value.right !== ".") {
        const rightNode = new mathMLTree.MathNode(
            "mo", [makeText(group.value.right, group.mode)]);

        rightNode.setAttribute("fence", "true");

        inner.push(rightNode);
    }

    const outerNode = new mathMLTree.MathNode("mrow", inner);

    return outerNode;
};

groupTypes.middle = function(group, options) {
    const middleNode = new mathMLTree.MathNode(
        "mo", [makeText(group.value.middle, group.mode)]);
    middleNode.setAttribute("fence", "true");
    return middleNode;
};

groupTypes.accent = function(group, options) {
    const accentNode = new mathMLTree.MathNode(
        "mo", [makeText(group.value.accent, group.mode)]);

    const node = new mathMLTree.MathNode(
        "mover",
        [buildGroup(group.value.base, options), accentNode]);

    node.setAttribute("accent", "true");

    return node;
};

groupTypes.spacing = function(group) {
    let node;

    if (group.value === "\\ " || group.value === "\\space" ||
        group.value === " " || group.value === "~") {
        node = new mathMLTree.MathNode(
            "mtext", [new mathMLTree.TextNode("\u00a0")]);
    } else {
        node = new mathMLTree.MathNode("mspace");

        node.setAttribute(
            "width", buildCommon.spacingFunctions[group.value].size);
    }

    return node;
};

groupTypes.op = function(group, options) {
    let node;

    // TODO(emily): handle big operators using the `largeop` attribute

    if (group.value.symbol) {
        // This is a symbol. Just add the symbol.
        node = new mathMLTree.MathNode(
            "mo", [makeText(group.value.body, group.mode)]);
    } else if (group.value.value) {
        // This is an operator with children. Add them.
        node = new mathMLTree.MathNode(
            "mo", buildExpression(group.value.value, options));
    } else {
        // This is a text operator. Add all of the characters from the
        // operator's name.
        // TODO(emily): Add a space in the middle of some of these
        // operators, like \limsup.
        node = new mathMLTree.MathNode(
            "mi", [new mathMLTree.TextNode(group.value.body.slice(1))]);
    }

    return node;
};

groupTypes.mod = function(group, options) {
    let inner = [];

    if (group.value.modType === "pod" || group.value.modType === "pmod") {
        inner.push(new mathMLTree.MathNode(
            "mo", [makeText("(", group.mode)]));
    }
    if (group.value.modType !== "pod") {
        inner.push(new mathMLTree.MathNode(
            "mo", [makeText("mod", group.mode)]));
    }
    if (group.value.value) {
        const space = new mathMLTree.MathNode("mspace");
        space.setAttribute("width", "0.333333em");
        inner.push(space);
        inner = inner.concat(buildExpression(group.value.value, options));
    }
    if (group.value.modType === "pod" || group.value.modType === "pmod") {
        inner.push(new mathMLTree.MathNode(
            "mo", [makeText(")", group.mode)]));
    }

    return new mathMLTree.MathNode("mo", inner);
};

groupTypes.katex = function(group) {
    const node = new mathMLTree.MathNode(
        "mtext", [new mathMLTree.TextNode("KaTeX")]);

    return node;
};

groupTypes.font = function(group, options) {
    const font = group.value.font;
    return buildGroup(group.value.body, options.withFont(font));
};

groupTypes.delimsizing = function(group) {
    const children = [];

    if (group.value.value !== ".") {
        children.push(makeText(group.value.value, group.mode));
    }

    const node = new mathMLTree.MathNode("mo", children);

    if (group.value.mclass === "mopen" ||
        group.value.mclass === "mclose") {
        // Only some of the delimsizing functions act as fences, and they
        // return "mopen" or "mclose" mclass.
        node.setAttribute("fence", "true");
    } else {
        // Explicitly disable fencing if it's not a fence, to override the
        // defaults.
        node.setAttribute("fence", "false");
    }

    return node;
};

groupTypes.styling = function(group, options) {
    const inner = buildExpression(group.value.value, options);

    const node = new mathMLTree.MathNode("mstyle", inner);

    const styleAttributes = {
        "display": ["0", "true"],
        "text": ["0", "false"],
        "script": ["1", "false"],
        "scriptscript": ["2", "false"],
    };

    const attr = styleAttributes[group.value.style];

    node.setAttribute("scriptlevel", attr[0]);
    node.setAttribute("displaystyle", attr[1]);

    return node;
};

groupTypes.sizing = function(group, options) {
    const inner = buildExpression(group.value.value, options);

    const node = new mathMLTree.MathNode("mstyle", inner);

    // TODO(emily): This doesn't produce the correct size for nested size
    // changes, because we don't keep state of what style we're currently
    // in, so we can't reset the size to normal before changing it.  Now
    // that we're passing an options parameter we should be able to fix
    // this.
    node.setAttribute(
        "mathsize", buildCommon.sizingMultiplier[group.value.size] + "em");

    return node;
};

groupTypes.overline = function(group, options) {
    const operator = new mathMLTree.MathNode(
        "mo", [new mathMLTree.TextNode("\u203e")]);
    operator.setAttribute("stretchy", "true");

    const node = new mathMLTree.MathNode(
        "mover",
        [buildGroup(group.value.body, options), operator]);
    node.setAttribute("accent", "true");

    return node;
};

groupTypes.underline = function(group, options) {
    const operator = new mathMLTree.MathNode(
        "mo", [new mathMLTree.TextNode("\u203e")]);
    operator.setAttribute("stretchy", "true");

    const node = new mathMLTree.MathNode(
        "munder",
        [buildGroup(group.value.body, options), operator]);
    node.setAttribute("accentunder", "true");

    return node;
};

groupTypes.rule = function(group) {
    // TODO(emily): Figure out if there's an actual way to draw black boxes
    // in MathML.
    const node = new mathMLTree.MathNode("mrow");

    return node;
};

groupTypes.kern = function(group) {
    // TODO(kevin): Figure out if there's a way to add space in MathML
    const node = new mathMLTree.MathNode("mrow");

    return node;
};

groupTypes.llap = function(group, options) {
    const node = new mathMLTree.MathNode(
        "mpadded", [buildGroup(group.value.body, options)]);

    node.setAttribute("lspace", "-1width");
    node.setAttribute("width", "0px");

    return node;
};

groupTypes.rlap = function(group, options) {
    const node = new mathMLTree.MathNode(
        "mpadded", [buildGroup(group.value.body, options)]);

    node.setAttribute("width", "0px");

    return node;
};

groupTypes.phantom = function(group, options) {
    const inner = buildExpression(group.value.value, options);
    return new mathMLTree.MathNode("mphantom", inner);
};

groupTypes.mclass = function(group, options) {
    const inner = buildExpression(group.value.value, options);
    return new mathMLTree.MathNode("mstyle", inner);
};

/**
 * Takes a list of nodes, builds them, and returns a list of the generated
 * MathML nodes. A little simpler than the HTML version because we don't do any
 * previous-node handling.
 */
const buildExpression = function(expression, options) {
    const groups = [];
    for (let i = 0; i < expression.length; i++) {
        const group = expression[i];
        groups.push(buildGroup(group, options));
    }
    return groups;
};

/**
 * Takes a group from the parser and calls the appropriate groupTypes function
 * on it to produce a MathML node.
 */
const buildGroup = function(group, options) {
    if (!group) {
        return new mathMLTree.MathNode("mrow");
    }

    if (groupTypes[group.type]) {
        // Call the groupTypes function
        return groupTypes[group.type](group, options);
    } else {
        throw new ParseError(
            "Got group of unknown type: '" + group.type + "'");
    }
};

/**
 * Takes a full parse tree and settings and builds a MathML representation of
 * it. In particular, we put the elements from building the parse tree into a
 * <semantics> tag so we can also include that TeX source as an annotation.
 *
 * Note that we actually return a domTree element with a `<math>` inside it so
 * we can do appropriate styling.
 */
const buildMathML = function(tree, texExpression, options) {
    const expression = buildExpression(tree, options);

    // Wrap up the expression in an mrow so it is presented in the semantics
    // tag correctly.
    const wrapper = new mathMLTree.MathNode("mrow", expression);

    // Build a TeX annotation of the source
    const annotation = new mathMLTree.MathNode(
        "annotation", [new mathMLTree.TextNode(texExpression)]);

    annotation.setAttribute("encoding", "application/x-tex");

    const semantics = new mathMLTree.MathNode(
        "semantics", [wrapper, annotation]);

    const math = new mathMLTree.MathNode("math", [semantics]);

    // You can't style <math> nodes, so we wrap the node in a span.
    return makeSpan(["katex-mathml"], [math]);
};

module.exports = buildMathML;
