local _, addon = ...

hooksecurefunc(WorldMapFrame, 'RefreshDetailLayers', function()
    for detailLayer in WorldMapFrame.detailLayerPool:EnumerateActive() do
        for detailTile in detailLayer.detailTilePool:EnumerateActive() do
            local fileDataID = detailTile:GetTexture()
            if addon.tiles[fileDataID] then
                detailTile:SetTexture(addon.tiles[fileDataID])
            end
        end
    end
end)
