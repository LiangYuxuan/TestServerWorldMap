/* eslint-disable no-await-in-loop */
/* eslint-disable no-bitwise */
/* eslint-disable no-console */

import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CASCClient, WDCReader, DBDParser } from '@rhyster/wow-casc-dbc';

import { latestVersion } from './client.ts';

const root = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const tocFile = path.join(root, 'TestServerWorldMap', 'TestServerWorldMap.toc');
const tocFileText = await fs.readFile(tocFile, 'utf-8');
const prevBuild = tocFileText.match(/## Version: (\d+)/)?.[1];

const currBuild = latestVersion.version.BuildId;
assert(currBuild, 'Failed to get current build number');

if (prevBuild === currBuild) {
    console.log(new Date().toISOString(), `[INFO]: Build ${currBuild} is up to date`);
    process.exit(0);
}

const client = new CASCClient('us', latestVersion.product, latestVersion.version);
await client.init();

console.log(new Date().toISOString(), '[INFO]: Loading remote TACT keys');
await client.loadRemoteTACTKeys();
console.log(new Date().toISOString(), '[INFO]: Loaded remote TACT keys');

const fileDataID2CKey = client.preload?.rootFile.fileDataID2CKey;
assert(fileDataID2CKey, 'Failed to get root file and fileDataID2CKey');

const loadDB2 = async (fileDataID: number) => {
    const cKeys = client.getContentKeysByFileDataID(fileDataID);
    assert(cKeys, `No cKeys found for fileDataID ${fileDataID.toString()}`);

    const cKey = cKeys
        // eslint-disable-next-line no-bitwise
        .find((data) => !!(data.localeFlags & CASCClient.LocaleFlags.enUS));
    assert(cKey, `No cKey found for fileDataID ${fileDataID.toString()} in enUS`);

    const data = await client.getFileByContentKey(cKey.cKey, true);
    const reader = new WDCReader(data.buffer, data.type === 'partial' ? data.blocks : undefined);
    const parser = await DBDParser.parse(reader);

    return parser;
};

console.log(new Date().toISOString(), '[INFO]: Loading DB2 files');
const [mapXArt, artTile, overlay, overlayTile] = await Promise.all([
    loadDB2(1957217), // dbfilesclient/uimapxmapart.db2
    loadDB2(1957210), // dbfilesclient/uimaparttile.db2
    loadDB2(1134579), // dbfilesclient/worldmapoverlay.db2
    loadDB2(1957212), // dbfilesclient/worldmapoverlaytile.db2
]);
console.log(new Date().toISOString(), '[INFO]: Loaded DB2 files');

console.log(new Date().toISOString(), '[INFO]: Parsing DB2 files');
const art2Map = new Map(
    mapXArt
        .getAllIDs()
        .map((id) => {
            const row = mapXArt.getRowData(id);
            const artID = row?.UiMapArtID;
            const mapID = row?.UiMapID;

            assert(typeof artID === 'number' && typeof mapID === 'number');

            return [artID, mapID];
        }),
);

interface TileFileInfo {
    fileDataID: number,
    source: 'ArtTile' | 'OverlayTile',
    cKey: string,
}

const tileFiles: TileFileInfo[] = [];
const handleMapFile = (fileDataID: number, artID: number, source: 'ArtTile' | 'OverlayTile') => {
    if (artID > 1800 && fileDataID > 0 && art2Map.has(artID)) {
        const cKeys = fileDataID2CKey.get(fileDataID);
        assert(cKeys, `Failed to get content keys of ${source} fileDataID ${fileDataID.toString()}`);

        const cKey = cKeys.find((v) => !!(v.localeFlags & CASCClient.LocaleFlags.enUS));
        const zhCN = cKeys.find((v) => !!(v.localeFlags & CASCClient.LocaleFlags.zhCN));

        if (cKey && !zhCN) {
            tileFiles.push({
                fileDataID, source, cKey: cKey.cKey,
            });
        }
    }
};

artTile
    .getAllIDs()
    .forEach((id) => {
        const row = artTile.getRowData(id);
        const fileDataID = row?.FileDataID;
        const artID = row?.UiMapArtID;

        assert(typeof fileDataID === 'number' && typeof artID === 'number');

        handleMapFile(fileDataID, artID, 'ArtTile');
    });

const overlay2Art = new Map(
    overlay
        .getAllIDs()
        .map((id) => {
            const row = overlay.getRowData(id);
            const artID = row?.UiMapArtID;

            assert(typeof artID === 'number');

            return [id, artID];
        }),
);

overlayTile
    .getAllIDs()
    .forEach((id) => {
        const row = overlayTile.getRowData(id);
        const fileDataID = row?.FileDataID;
        const overlayID = row?.WorldMapOverlayID;

        assert(typeof fileDataID === 'number' && typeof overlayID === 'number');

        const artID = overlay2Art.get(overlayID);

        assert(artID);

        handleMapFile(fileDataID, artID, 'OverlayTile');
    });
console.log(new Date().toISOString(), '[INFO]: Parsed DB2 files');

if (tileFiles.length === 0) {
    console.log(new Date().toISOString(), '[INFO]: No tile files found');
    process.exit(0);
}

console.log(new Date().toISOString(), '[INFO]: Generating tile files list');
const tileIDs = tileFiles
    .map(({ fileDataID }) => `[${fileDataID.toString()}] = "Interface/AddOns/TestServerWorldMap/tiles/${fileDataID.toString()}.blp"`)
    .join(',\n    ');

const dataFile = path.join(root, 'TestServerWorldMap', 'Data.lua');
await fs.writeFile(
    dataFile,
    `local _, addon = ...\n\naddon.tiles = {\n    ${tileIDs},\n}\n`,
);
console.log(new Date().toISOString(), '[INFO]: Generated tile files list');

console.log(new Date().toISOString(), '[INFO]: Updating tile files');
const tilesDir = path.join(root, 'TestServerWorldMap', 'tiles');
await fs.rm(tilesDir, { recursive: true }).catch(() => {});
await fs.mkdir(tilesDir);

// eslint-disable-next-line no-restricted-syntax
for (const { fileDataID, cKey } of tileFiles) {
    console.log(new Date().toISOString(), `[INFO]: Download ${fileDataID.toString()}.blp`);

    const res = await client.getFileByContentKey(cKey);

    const file = path.join(tilesDir, `${fileDataID.toString()}.blp`);
    await fs.writeFile(file, res.buffer);
}
console.log(new Date().toISOString(), '[INFO]: Updated tile files');

console.log(new Date().toISOString(), '[INFO]: Updating TOC file');
const tocFileNew = tocFileText.replace(/## Version: \d+/, `## Version: ${currBuild}`);
await fs.writeFile(tocFile, tocFileNew);
console.log(new Date().toISOString(), '[INFO]: Updated TOC file');

console.log(new Date().toISOString(), '[INFO]: Packaging addon');
spawnSync('zip', ['-r', `TestServerWorldMap-${currBuild}.zip`, 'TestServerWorldMap'], { cwd: root });
console.log(new Date().toISOString(), '[INFO]: Packaged addon');

if (process.env.GITHUB_OUTPUT) {
    await fs.writeFile(process.env.GITHUB_OUTPUT, `updated=true\nbuild=${currBuild}\n`, { flag: 'a' });
}
