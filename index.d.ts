declare interface Message {
    type: string;
    id?: string;
    order?: string[];
}

declare interface Art {
    order: string[];
    layers: {
        [key: string]: Set<{ name: string; id: string }>;
    };
    selected: {
        [key: string]: string;
    };
}

declare module "uint8-to-base64";
