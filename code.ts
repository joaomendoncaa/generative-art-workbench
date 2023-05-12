const rules = {
    frameIdentifier: "trait#",
};

let store: Art = {
    order: [],
    layers: {},
    selected: {},
};

/**
 *    ______           _                                    _           _
 *   |  ____|         | |                                  (_)         | |
 *   | |__     _ __   | |_   _ __   _   _   _ __     ___    _   _ __   | |_
 *   |  __|   | '_ \  | __| | '__| | | | | | '_ \   / _ \  | | | '_ \  | __|
 *   | |____  | | | | | |_  | |    | |_| | | |_) | | (_) | | | | | | | | |_
 *   |______| |_| |_|  \__| |_|     \__, | | .__/   \___/  |_| |_| |_|  \__|
 *                                   __/ | | |
 *                                  |___/  |_|
 **/

async function main(): Promise<void> {
    if (!figma.editorType || figma.editorType !== "figma") {
        exitFigma("This plugin is only available in Figma Design Files, not Figjam!");
    }

    figma.showUI(__html__, {
        width: 500,
        height: 575,
        title: "Generative Art Workbench",
        themeColors: true,
    });

    rigStore();

    figma.ui.onmessage = handleUIMessage;
    figma.on("selectionchange", sendSelectedFrames);
}

main().catch((err) => {
    exitFigma(err);
});

/**
 *    _    _          _
 *   | |  | |        | |
 *   | |__| |   ___  | |  _ __     ___   _ __   ___
 *   |  __  |  / _ \ | | | '_ \   / _ \ | '__| / __|
 *   | |  | | |  __/ | | | |_) | |  __/ | |    \__ \
 *   |_|  |_|  \___| |_| | .__/   \___| |_|    |___/
 *                       | |
 *                       |_|
 **/

async function handleUIMessage(message: Message) {
    switch (message.type) {
        case "close":
            exitFigma();
            break;
        default:
            console.error(`handleUIMessage() can't handle "${message.type}" type messages`);
            break;
    }
}

function sendSelectedFrames(): void {
    const selectedFrames = figma.currentPage.selection.filter((layer) => layer.type === "FRAME");

    console.log(selectedFrames);

    figma.ui.postMessage({
        type: "display",
        html: "loading",
    });
}

async function rigStore(): Promise<boolean> {
    console.log("Rigging store with page data");

    const frames = figma.currentPage.children.filter(
        (node) => node.type === "FRAME" && node.name.startsWith(rules.frameIdentifier)
    );

    console.log(frames);

    figma.ui.postMessage({
        type: "display",
        html: "loading",
    });

    return true;
}

function exitFigma(message?: string): void {
    const exitMessage = "👋 Exiting workbench";

    console.warn(`${exitMessage}\n${message ? `(${message})` : ""}`);
    figma.notify(`${exitMessage}\n${message ? `(${message})` : ""}`);
    figma.closePlugin();
}

function buildHTMLFromSelectedFrames() {}
