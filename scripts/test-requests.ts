const endpoints = [
    '/hello',
    '/demo',
    '/test',
    '/message'
];

await Bun.sleep(5000);

let count = 0;
while (count < 10) {
    const endpoint = endpoints[count % endpoints.length];
    const response = await fetch(`http://localhost:8787${endpoint}`);
    console.log(response);
    await Bun.sleep(1000);
    count++;
}