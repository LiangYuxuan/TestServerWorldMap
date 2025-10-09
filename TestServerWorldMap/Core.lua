local _, addon = ...

local mapCanvasMixinFrames = {
    ['Blizzard_WorldMap'] = {
        {
            -- WorldMapFrame -> WorldMapFrameTemplate -> MapCanvasFrameTemplate -> MapCanvasMixin
            name = 'WorldMapFrame',
        }
    },
    ['Blizzard_AnimaDiversionUI'] = {
        {
            -- AnimaDiversionFrame -> MapCanvasFrameTemplate -> MapCanvasMixin
            name = 'AnimaDiversionFrame',
        }
    },
    ['Blizzard_BattlefieldMap'] = {
        {
            -- BattlefieldMapFrame -> MapCanvasFrameTemplate -> MapCanvasMixin
            name = 'BattlefieldMapFrame',
        }
    },
    ['Blizzard_FlightMap'] = {
        {
            -- FlightMapFrame -> MapCanvasFrameTemplate -> MapCanvasMixin
            name = 'FlightMapFrame',
        }
    },
    ['Blizzard_HousingHouseFinder'] = {
        {
            -- HouseFinderFrame.HouseFinderMapCanvas -> MapCanvasFrameTemplate -> MapCanvasMixin
            name = 'HouseFinderFrame',
            key = 'HouseFinderMapCanvas',
        }
    },
    ['Blizzard_HybridMinimap'] = {
        {
            -- HybridMinimap.MapCanvas -> MapCanvasFrameTemplate -> MapCanvasMixin
            name = 'HybridMinimap',
            key = 'MapCanvas',
        }
    },
    ['Blizzard_GarrisonUI'] = {
        {
            -- BFAMissionFrame.MapTab -> MapCanvasMixin
            name = 'BFAMissionFrame',
            key = 'MapTab',
        },
        {
            -- CovenantMissionFrame.MapTab -> MapCanvasMixin
            name = 'CovenantMissionFrame',
            key = 'MapTab',
        },
        {
            -- OrderHallMissionFrame.MapTab -> MapCanvasMixin
            name = 'OrderHallMissionFrame',
            key = 'MapTab',
        },
    },
}

local function handleMapCanvasMixinFrame(frame)
    hooksecurefunc(frame, 'RefreshDetailLayers', function()
        for detailLayer in frame.detailLayerPool:EnumerateActive() do
            for detailTile in detailLayer.detailTilePool:EnumerateActive() do
                local fileDataID = detailTile:GetTexture()
                if addon.tiles[fileDataID] then
                    detailTile:SetTexture(addon.tiles[fileDataID], nil, nil, 'TRILINEAR')
                end
            end
        end
    end)

    for pin in frame:EnumeratePinsByTemplate('MapExplorationPinTemplate') do
        hooksecurefunc(pin, 'RefreshOverlays', function()
            for texture in pin.overlayTexturePool:EnumerateActive() do
                local fileDataID = texture:GetTexture()
                if addon.tiles[fileDataID] then
                    texture:SetTexture(addon.tiles[fileDataID], nil, nil, 'TRILINEAR')
                end
            end
        end)
    end
end

local function handleMapCanvasMixinFrames(framesInfo)
    for _, frameInfo in ipairs(framesInfo) do
        local frame = _G[frameInfo.name]
        if frame and frameInfo.key then
            frame = frame[frameInfo.key]
        end

        if frame then
            handleMapCanvasMixinFrame(frame)
        end
    end
end

local pendingMapCanvasMixinFrames = {}

for addonName, framesInfo in pairs(mapCanvasMixinFrames) do
    if C_AddOns.IsAddOnLoaded(addonName) then
        handleMapCanvasMixinFrames(framesInfo)
    else
        pendingMapCanvasMixinFrames[addonName] = framesInfo
    end
end

if next(pendingMapCanvasMixinFrames) then
    local eventFrame = CreateFrame('Frame')
    eventFrame:RegisterEvent('ADDON_LOADED')
    eventFrame:SetScript('OnEvent', function(self, event, addonName)
        if event == 'ADDON_LOADED' then
            local framesInfo = pendingMapCanvasMixinFrames[addonName]
            if framesInfo then
                handleMapCanvasMixinFrames(framesInfo)
                pendingMapCanvasMixinFrames[addonName] = nil

                if not next(pendingMapCanvasMixinFrames) then
                    self:UnregisterEvent('ADDON_LOADED')
                    self:SetScript('OnEvent', nil)
                end
            end
        end
    end)
end
