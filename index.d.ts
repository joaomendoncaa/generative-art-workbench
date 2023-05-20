declare interface Message {
    type: string;
    id?: string;
    order?: string[] | string;
}

declare interface Art {
    order: string[];
    layers: {
        [key: string]: {
            [key: string]: string;
        };
    };
    selected: {
        [key: string]: string;
    };
}

declare module "uint8-to-base64";
