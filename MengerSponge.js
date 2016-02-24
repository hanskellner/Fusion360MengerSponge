//Author-Hans Kellner
//Description-Generate a Menger Sponge model in Autodesk Fusion 360.

/*!
Copyright (C) 2016 Hans Kellner: https://github.com/hanskellner/Fusion360MengerSponge
MIT License: See https://github.com/hanskellner/Fusion360MengerSponge/LICENSE.md
*/

/*
This is a script for Autodesk Fusion 360 that generates Menger sponge models.

Installation:

Copy the "MengerSponge" fodler into your Fusion 360 "My Scripts" folder. You may find this folder using the following steps:

1) Start Fusion 360 and then select the File -> Scripts... menu item
2) The Scripts Manager dialog will appear and display the "My Scripts" folder and "Sample Scripts" folders
3) Select one of the "My Scripts" files and then click on the "+" Details icon near the bottom of the dialog.
  a) If there are no files in the "My Scripts" folder then create a default one.
  b) Click the Create button, select JavaScript, and then OK.
5) With the user script selected, click the Full Path "..." button to display a file explorer window that will display the "My Scripts" folder
6) Copy the files into the folder

For example, on a Mac the folder is located in:
/Users/USERNAME/Library/Application Support/Autodesk/Autodesk Fusion 360/API/Scripts
*/

/*globals adsk*/
function run(context) {

    "use strict";

    if (adsk.debug === true) {
        /*jslint debug: true*/
        debugger;
        /*jslint debug: false*/
    }

	var appTitle = 'Voronoi Sketch Generator';

	var app = adsk.core.Application.get(), ui;
    if (app) {
        ui = app.userInterface;
    }

	var design = adsk.fusion.Design(app.activeProduct);
	if (!design) {
		ui.messageBox('No active design', appTitle);
		adsk.terminate();
		return;
	}

    // Create the command definition.
    var createCommandDefinition = function() {
        var commandDefinitions = ui.commandDefinitions;

        // Be fault tolerant in case the command is already added...
        var cmDef = commandDefinitions.itemById('MengerSpongeGenerator');
        if (!cmDef) {
            cmDef = commandDefinitions.addButtonDefinition('MengerSpongeGenerator',
                    'Menger Sponge Generator',
                    'Generates a Menger Sponge model.',
                    './resources'); // relative resource file path is specified
        }
        return cmDef;
    };

    // CommandCreated event handler.
    var onCommandCreated = function(args) {
        try {
            // Connect to the CommandExecuted event.
            var command = args.command;
            command.execute.add(onCommandExecuted);

            // Terminate the script when the command is destroyed
            command.destroy.add(function () { adsk.terminate(); });

            // Define the inputs.
            var inputs = command.commandInputs;

            // ISSUE: Unit type needs to be specified but I just need a unitless value. For unitless
            // I'll have to use string input for now.
            var levelsInput = inputs.addStringValueInput('levels','Number of Levels (1-4)','2');

            // Ask for a component to use for each cell.  If none then create a default component block
            var compSelectionInput = inputs.addSelectionInput('comp', 'Cell Component', 'Select component to use for each cell');
            compSelectionInput.addSelectionFilter('RootComponents');
            compSelectionInput.setSelectionLimits(0,1);

            // Length of each cell.  Defines width, length, height
            var cellLength = adsk.core.ValueInput.createByString("1 cm");
            inputs.addValueInput('cellLength', 'Cell Length', 'cm' , cellLength);
        }
        catch (e) {
            ui.messageBox('Failed to create command : ' + (e.description ? e.description : e));
        }
    };

    // CommandExecuted event handler.
    var onCommandExecuted = function(args) {
        try {

            // Extract input values
            var unitsMgr = app.activeProduct.unitsManager;
            var command = adsk.core.Command(args.firingEvent.sender);
            var inputs = command.commandInputs;

            var levelsInput, compSelCmdInput, cellLengthInput;

            // REVIEW: Problem with a problem - the inputs are empty at this point. We
            // need access to the inputs within a command during the execute.
            for (var n = 0; n < inputs.count; n++) {
                var input = inputs.item(n);
                if (input.id === 'levels') {
                    levelsInput = adsk.core.StringValueCommandInput(input);
                }
                else if (input.id === 'comp') {
                    compSelCmdInput = adsk.core.SelectionCommandInput(input);
                }
                else if (input.id === 'cellLength') {
                    cellLengthInput = adsk.core.ValueCommandInput(input);
                }
            }

            if (!levelsInput || !compSelCmdInput || !cellLengthInput) {
                ui.messageBox("One of the inputs does not exist.");
                return;
            }

            // holds the parameters
            var paramLevels = 3;
            var paramProtoComponent = null;
            var paramCellLength = 1;

            if (levelsInput.value !== '') {
                paramLevels = parseInt(levelsInput.value);
            }

            if (paramLevels < 1 || paramLevels > 4) {
                ui.messageBox("Invalid number of levels: must be 1 to 4");
                return;
            }

            if (compSelCmdInput.selectionCount === 1) {
                // Get prototype component
                paramProtoComponent = compSelCmdInput.selection(0).entity;
            }

            // Length (and width and height) of prototype cell
            paramCellLength = unitsMgr.evaluateExpression(cellLengthInput.expression);
            if (paramCellLength <= 0.0) {
                ui.messageBox("Invalid cell length: must be > 0");
                return;
            }

            // Generate the drawing
			generateMengerSponge(paramLevels, paramProtoComponent, paramCellLength);
        }
        catch (e) {
            ui.messageBox('Failed to execute command : ' + (e.description ? e.description : e));
        }
    };

	function generateMengerSponge(levels, protoComponent, cellLength) {

        var mengerGen = new MengerSpongeGenerator();
        if (mengerGen.generate(levels)) {
            console.log("Generated Mengel Sponge.  Size = " + mengerGen.size());
        }
        else {
            console.log("ERROR: Unable to generate Mengel Sponge")
        }

        var root = design.rootComponent;

        // Create a component to hold all the child cell components.
        var newOccurence = root.occurrences.addNewComponent(adsk.core.Matrix3D.create());
        var parentCellComponent = newOccurence.component;
        parentCellComponent.name = "Menger Sponge";

        // Get construction planes
        var planes = root.constructionPlanes;

        // Create construction plane input
        var planeInput = planes.createInput();

        // Do we need to create a prototype component?
        if (protoComponent == null) {

            // Need sketch to create proto cell body
            var sketch = root.sketches.add(root.xYConstructionPlane);
            sketch.name = "Menger - " + sketch.name;

            var sketchLines = sketch.sketchCurves.sketchLines;
            var lines = adsk.core.ObjectCollection.create();

            var pt1 = adsk.core.Point3D.create(0, 0, 0);
            var pt2 = adsk.core.Point3D.create(0, cellLength, 0);
            var pt3 = adsk.core.Point3D.create(cellLength, cellLength, 0);
            var pt4 = adsk.core.Point3D.create(cellLength, 0, 0);

            lines.add(sketchLines.addByTwoPoints(pt1, pt2));
            lines.add(sketchLines.addByTwoPoints(pt2, pt3));
            lines.add(sketchLines.addByTwoPoints(pt3, pt4));
            lines.add(sketchLines.addByTwoPoints(pt4, pt1));

            var profs = adsk.core.ObjectCollection.create();
            for (var iprof = 0; iprof < sketch.profiles.count; iprof++) {
                profs.add(sketch.profiles.item(iprof));
            }

            // Create a component with ExtrudeFeature.
            var extrudeFeatures = root.features.extrudeFeatures;
            var extrudeFeatureInput = extrudeFeatures.createInput(profs, adsk.fusion.FeatureOperations.NewBodyFeatureOperation);
            extrudeFeatureInput.setDistanceExtent(false, adsk.core.ValueInput.createByReal(cellLength));
            var extrudeFeature = extrudeFeatures.add(extrudeFeatureInput);

            // Get the body created by the extrusion
            var body = extrudeFeature.bodies.item(0);

            // Create a component to hold the proto cell
            var protoOccurence = parentCellComponent.occurrences.addNewComponent(adsk.core.Matrix3D.create());
            protoComponent = protoOccurence.component;

            // Move the body into the prototype occurence
            var movedBody = body.moveToComponent(protoOccurence);
            //movedBody.isLightBulbOn = false;
        }
        else {
            // Get size of prototype cell and calculate how much it should be scaled
            var bboxBody = protoComponent.boundingBox;
            var xMin = bboxBody.minPoint.x, xMax = bboxBody.maxPoint.x;
            var yMin = bboxBody.minPoint.y, yMax = bboxBody.maxPoint.y;
            var zMin = bboxBody.minPoint.z, zMax = bboxBody.maxPoint.z;

            var bboxLength = xMax - xMin;
            var bboxWidth  = yMax - yMin;
            var bboxHeight = zMax - zMin;

            // TODO
        }

        if (ui) {
            ui.messageBox('Ready to generate Menger Sponge of size ' + mengerGen.size());
        }

        // Create an offset sketch on XY plane for each Z level.
        for (var z = 0; z < mengerGen.size(); z++) {
            for (var x = 0; x < mengerGen.size(); x++) {
                for (var y = 0; y < mengerGen.size(); y++) {

                    // Is there a block at this location?
                    if (!mengerGen.getBlock(x,y,z)) {
                        continue; // no so skip
                    }

                    // For each of the cells on this level, create an instance of the prototype cell component
                    // and make it a child of the proto
                    var tx = adsk.core.Matrix3D.create();
                    tx.translation = adsk.core.Vector3D.create(x*cellLength, y*cellLength, z*cellLength);
                    var newCellOccur = parentCellComponent.occurrences.addExistingComponent(protoComponent, tx);
                    //newCellOccur.isLightBulbOn = true;
                }
            }
        }
	}

    // Start of the script...
	try {

        // Create and run command
        var command = createCommandDefinition();
        var commandCreatedEvent = command.commandCreated;
        commandCreatedEvent.add(onCommandCreated);

        command.execute();
    }
    catch (e) {
        if (ui) {
            ui.messageBox('Script Failed : ' + (e.description ? e.description : e));
        }

        adsk.terminate();
    }
}
