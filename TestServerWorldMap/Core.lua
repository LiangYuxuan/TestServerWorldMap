local _, addon = ...

hooksecurefunc(WorldMapFrame, 'RefreshDetailLayers', function()
    for detailLayer in WorldMapFrame.detailLayerPool:EnumerateActive() do
        for detailTile in detailLayer.detailTilePool:EnumerateActive() do
            local fileDataID = detailTile:GetTexture()
            if addon.tiles[fileDataID] then
                detailTile:SetTexture(addon.tiles[fileDataID], nil, nil, 'TRILINEAR')
            end
        end
    end
end)

for pin in WorldMapFrame:EnumeratePinsByTemplate('MapExplorationPinTemplate') do
    hooksecurefunc(pin, 'RefreshOverlays', function()
        for texture in pin.overlayTexturePool:EnumerateActive() do
            local fileDataID = texture:GetTexture()
            if addon.tiles[fileDataID] then
                texture:SetTexture(addon.tiles[fileDataID], nil, nil, 'TRILINEAR')
            end
        end
    end)
end
