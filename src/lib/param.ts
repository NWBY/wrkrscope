export interface CommonParams {
    project: string;
}

export interface KvParams extends CommonParams {
    id: string;
}

export interface D1Params extends CommonParams {
    filename: string;
}