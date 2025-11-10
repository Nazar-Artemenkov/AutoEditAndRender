(function () {
    app.beginUndoGroup("Auto Edit and Render");

    //Пошук композиції по імені.
    function findComp(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof CompItem && it.name === name) return it;
        }
        return null;
    }

    //Заміна тексту в всіх слоях композиції
    function replaceTextInComp(comp) {
        for (var i = 1; i <= comp.numLayers; i++) {
            var lyr = comp.layer(i);
            if (lyr.matchName === "ADBE Text Layer"){
                var txtProp = lyr.property("Source Text");
                if (txtProp) {
                    var td = txtProp.value;
                    td.text = "Changed";
                    txtProp.setValue(td);
                }
            }
        }
    }

    //Імпорт відео і вставка в перекомпозицію
    function importAndFitVideo(compName, videoFile){
        var c = findComp(compName);
        if (!c) return;

        //Видаляєм старі слої
        for (var i = c.numLayers; i >= 1; i--) c.layer(i).remove();

        //імпортуєм відео
        var footage = app.project.importFile(new ImportOptions(videoFile));
        var lyr = c.layers.add(footage);

        //вираховуємо масштаб
        var scaleX = (c.width / footage.width) * 100;
        var scaleY = (c.height / footage.height) * 100;
        lyr.property("Scale").setValue([scaleX, scaleY]);
    }

    //Знаходимо основні композиції
    var compRender = findComp("Render");
    var compCustomize = findComp("Customize Scene");
    if (!compRender || !compCustomize) {
        alert("No Render or Customize Scene compositions found!")
        return;
    }

    //
    var linkedLayers = [];
    function scanExpressions(comp, targetComp){
        for (var i = 1; i <= comp.numLayers; i++){
            var layer = comp.layer(i);
            function walk(group) {
                for (var j = 1; j <= group.numProperties; j++) {
                    var prop = group.property(j);
                    if (prop.canSetExpression && prop.expressionEnabled && prop.expression) {
                        if (prop.expression.indexOf(targetComp.name) !== -1) {
                            linkedLayers.push({
                                layer: layer.name,
                                expr: prop.expression
                            })
                        }
                    }
                    if (prop.numProperties > 0) walk(prop);
                }
            }
            walk(layer);
        }
    }

    scanExpressions(compRender, compCustomize);
    $.writeIn("Found connections: " + linkedLayers.length);

    //
    replaceTextInComp(compRender);
    replaceTextInComp(compCustomize);

    //
    var basePath = Folder.selectDialog("Select the folder where the videos are located")
    if (!basePath) {
        alert("Video selection deselected");
        return;
    }

    importAndFitVideo("Video 1", File(basePath.fsName + "/Video 1.mp4"));
    importAndFitVideo("Video 2", File(basePath.fsName + "/Video 2.mp4"));
    importAndFitVideo("Video 3", File(basePath.fsName + "/Video 3.mp4"));

    //
    var outFolder = Folder.selectDialog("Select a folder to render");
    if (outFolder) {
        var rqItem = app.project.renderQueue.items.add(compRender);
        rqItem.outputModule(1).file = new File(outFolder.fsName + "/final_output.mov");
        app.project.renderQueue.render();
        alert("Render complete!")
    }

    app.endUndoGroup();
})();
