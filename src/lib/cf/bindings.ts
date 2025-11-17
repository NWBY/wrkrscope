export interface KvBinding {
    binding: string;
    id: string;
}

export interface D1Binding {
    binding: string;
    database_id: string;
    database_name: string;
}

export interface R2Binding {
    binding: string;
    bucket_name: string;
}

export interface DurableObjectBinding {
    class_name: string;
    name: string;
}

export interface AssetsBinding {
    binding: string;
    directory: string;
}