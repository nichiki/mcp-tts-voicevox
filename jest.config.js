/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testPathIgnorePatterns: [
        "/node_modules/",
        "/dist/", // distディレクトリを無視
        "src/test.ts" // src/test.ts を無視
    ],
    moduleNameMapper: {
        // 必要に応じてモジュールのマッピングを追加
    },
    // setupFilesAfterEnv: ['./jest.setup.js'], // セットアップファイルが必要な場合
}; 