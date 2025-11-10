(function () {
    // Undo група для відкату змін
    app.beginUndoGroup("Auto Edit and Render");

    // Пошук композиції за назвою
    function findComp(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof CompItem && it.name === name) return it;
        }
        return null;
    }

    // Заміна тексту в усіх текстових шарах
    function replaceTextInComp(comp) {
        if (!(comp instanceof CompItem)) return;
        for (var i = 1; i <= comp.numLayers; i++) {
            var lyr = comp.layer(i);
            if (lyr.matchName === "ADBE Text Layer") {
                var txtProp = lyr.property("Source Text");
                if (txtProp) {
                    var td = txtProp.value;
                    td.text = "Changed";
                    txtProp.setValue(td);
                    $.writeln("Text replaced in layer: " + lyr.name);
                }
            }
        }
    }

    // Імпорт відео у прекомпозицію
    function importAndFitVideo(compName, videoFile) {
        var c = findComp(compName);
        if (!c) {
            $.writeln("Composition not found: " + compName);
            return false;
        }

        if (!videoFile.exists) {
            $.writeln("File not found: " + videoFile.fsName);
            return false;
        }

        // Видалення старих шарів
        for (var i = c.numLayers; i >= 1; i--) c.layer(i).remove();

        // Імпорт відео
        var footage = app.project.importFile(new ImportOptions(videoFile));
        var lyr = c.layers.add(footage);

        // Масштаб з урахуванням пропорцій
        if (footage.width > 0 && footage.height > 0) {
            var scaleFactor = Math.max(c.width / footage.width, c.height / footage.height) * 100;
            lyr.property("Scale").setValue([scaleFactor, scaleFactor]);
        }

        lyr.property("Position").setValue([c.width / 2, c.height / 2]);
        $.writeln("Video imported into: " + compName);
        return true;
    }

    // Пошук зв’язків між композиціями
    var linkedLayers = [];
    function scanExpressions(comp, targetComp) {
        if (!(comp instanceof CompItem) || !(targetComp instanceof CompItem)) return;
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            function walk(group) {
                for (var j = 1; j <= group.numProperties; j++) {
                    var prop = group.property(j);
                    if (prop.canSetExpression && prop.expressionEnabled && prop.expression) {
                        if (prop.expression.indexOf(targetComp.name) !== -1) {
                            linkedLayers.push({
                                layer: layer.name,
                                expr: prop.expression
                            });
                        }
                    }
                    if (prop.numProperties > 0) walk(prop);
                }
            }
            walk(layer);
        }
    }

    try {
        // Основні композиції
        var compRender = findComp("Render");
        var compCustomize = findComp("Customize Scene");
        if (!compRender || !compCustomize) {
            alert("No Render or Customize Scene compositions found!");
            app.endUndoGroup();
            return;
        }

        // Аналіз зв’язків
        scanExpressions(compRender, compCustomize);
        $.writeln("Found " + linkedLayers.length + " connections between Render and Customize Scene");

        // Вибір папки з відео
        var basePath = Folder.selectDialog("Select the folder where the videos are located");
        if (!basePath) {
            alert("Video selection deselected");
            app.endUndoGroup();
            return;
        }

        // Заміна тексту
        replaceTextInComp(compRender);
        replaceTextInComp(compCustomize);

        // Імпорт відео
        var importedAny = false;
        importedAny = importAndFitVideo("Video 1", File(basePath.fsName + "/Video 1.mp4")) || importedAny;
        importedAny = importAndFitVideo("Video 2", File(basePath.fsName + "/Video 2.mp4")) || importedAny;
        importedAny = importAndFitVideo("Video 3", File(basePath.fsName + "/Video 3.mp4")) || importedAny;

        if (!importedAny) {
            alert("No videos imported.");
            app.endUndoGroup();
            return;
        }

        app.endUndoGroup();

        // Вибір папки для фінального рендеру
        var outFolder = Folder.selectDialog("Select a folder to render");
        if (outFolder) {
            var rqItem = app.project.renderQueue.items.add(compRender);
            rqItem.outputModule(1).file = new File(outFolder.fsName + "/final_output.mov");

            // Запуск рендеру
            $.writeln("Rendering started...");
            app.project.renderQueue.render();
            $.writeln("Render complete: " + outFolder.fsName + "/final_output.mov");

            alert("Render complete!");
        }
    } catch (err) {
        // Обробка помилок
        app.endUndoGroup();
        alert("Error: " + err.toString());
        $.writeln("Error: " + err.toString());
    }
})();
