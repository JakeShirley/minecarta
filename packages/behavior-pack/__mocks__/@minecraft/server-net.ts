/**
 * Mock implementation of @minecraft/server-net for testing.
 * This module is only available in Bedrock Dedicated Server runtime.
 */

export enum HttpRequestMethod {
    Delete = 'DELETE',
    Get = 'GET',
    Head = 'HEAD',
    Post = 'POST',
    Put = 'PUT',
}

export class HttpRequest {
    uri: string;
    method: HttpRequestMethod;
    body: string;
    headers: HttpHeader[];
    timeout: number;

    constructor(uri: string) {
        this.uri = uri;
        this.method = HttpRequestMethod.Get;
        this.body = '';
        this.headers = [];
        this.timeout = 30;
    }

    setMethod(method: HttpRequestMethod): HttpRequest {
        this.method = method;
        return this;
    }

    setBody(body: string): HttpRequest {
        this.body = body;
        return this;
    }

    addHeader(key: string, value: string): HttpRequest {
        this.headers.push(new HttpHeader(key, value));
        return this;
    }

    setHeaders(headers: HttpHeader[]): HttpRequest {
        this.headers = headers;
        return this;
    }

    setTimeout(timeout: number): HttpRequest {
        this.timeout = timeout;
        return this;
    }
}

export class HttpHeader {
    key: string;
    value: string;

    constructor(key: string, value: string) {
        this.key = key;
        this.value = value;
    }
}

export class HttpResponse {
    status: number;
    body: string;
    headers: HttpHeader[];

    constructor() {
        this.status = 200;
        this.body = '';
        this.headers = [];
    }
}

export const http = {
    request: async (_request: HttpRequest): Promise<HttpResponse> => {
        return new HttpResponse();
    },
};
