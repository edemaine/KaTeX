import buildHTML from "./buildHTML";
import buildMathML from "./buildMathML";
import buildCommon from "./buildCommon";
import Options from "./Options";
import ParseError from "./ParseError";
import Settings from "./Settings";
import Style from "./Style";

const buildTree = function(tree, expression, settings) {
    settings = settings || new Settings({});

    let startStyle = Style.TEXT;
    if (settings.displayMode) {
        startStyle = Style.DISPLAY;
    }

    // Setup the default options
    const options = new Options({
        style: startStyle,
        maxSize: settings.maxSize,
    });

    // `buildHTML` sometimes messes with the parse tree (like turning bins ->
    // ords), so we build the MathML version first.
    const mathMLNode = buildMathML(tree, expression, options);
    const htmlNode = buildHTML(tree, options);

    const katexNode = buildCommon.makeSpan(["katex"], [
        mathMLNode, htmlNode,
    ]);

    if (settings.displayMode) {
        const nodes = [katexNode];
        if (htmlNode.tag) {
            nodes.push(htmlNode.tag);
            //nodes.unshift(htmlNode.tag);
        }
        return buildCommon.makeSpan(["katex-display"], nodes);
    } else {
        if (htmlNode.tag) {
            throw new ParseError("\\tag requires displayMode set to true");
        }
        return katexNode;
    }
};

export default buildTree;
