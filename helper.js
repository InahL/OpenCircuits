
/* Should be const instead of var
   but Safari does not allow it */
var IO_PORT_LENGTH = 60;
var IO_PORT_RADIUS = 7;
var IO_PORT_BORDER_WIDTH = 1;
var DEFAULT_SIZE = 50;
var GRID_SIZE = 50;

var OPTION_KEY = 18;
var SHIFT_KEY = 16;
var DELETE_KEY = 8;
var ENTER_KEY = 13;
var C_KEY = 67;
var X_KEY = 88;
var V_KEY = 86;
var CONTROL_KEY = 17;
var COMMAND_KEY = 91;

function clamp(x, min, max) {
    return Math.min(Math.max(x, min), max);
}

// Pos must be in world coords
function containsPoint(transform, pos) {
    var tr = transform.size.scale(0.5);
    var bl = transform.size.scale(-0.5);
    var p  = transform.toLocalSpace(pos);

    //
    // DEBUG DRAWING
    //
    // var renderer = getCurrentContext().getRenderer();
    // renderer.save();
    // transform.transformCtx(renderer.context);
    // renderer.rect(0, 0, transform.size.x, transform.size.y, '#ff00ff', '#000');
    // renderer.restore();
    // var camera = getCurrentContext().getCamera();
    // var mv = camera.getScreenPos(pos);
    // renderer.circle(mv.x, mv.y, 5, '#00ff00', '#000', 1 / camera.zoom);

    return (p.x > bl.x &&
            p.y > bl.y &&
            p.x < tr.x &&
            p.y < tr.y);
}

// Pos must be in world coords
function circleContains(transform, pos) {
    var v = transform.toLocalSpace(pos);

    //
    // DEBUG DRAWING
    //
    // saveCtx();
    // transform.transfomCtx(frame.context);
    // circle(0, 0, transform.size.x, '#ff00ff', '#000');
    // restoreCtx();
    // var mv = camera.getScreenPos(pos);
    // circle(mv.x, mv.y, 5, '#00ff00', '#000', 1 / camera.zoom);

    return (v.len2() <= transform.size.x*transform.size.x/4);
}

/**
 * Compares two transforms to see if they overlap.
 * First tests it using a quick circle-circle
 * intersection using the 'radius' of the transform
 *
 * Then uses a SAT (Separating Axis Theorem) method
 * to determine whether or not the two transforms
 * are intersecting
 *
 * @param  {Transform} a
 *         The first transform
 *
 * @param  {Transform} b
 *         The second transform
 *
 * @return {Boolean}
 *         True if the two transforms are overlapping,
 *         false otherwise
 */
function transformContains(A, B) {
    // Quick check circle-circle intersection
    var r1 = A.getRadius();
    var r2 = B.getRadius();
    var sr = r1 + r2;                       // Sum of radius
    var dpos = A.getPos().sub(B.getPos());  // Delta position
    if (dpos.dot(dpos) > sr*sr)
        return false;

    /* Perform SAT */

    // Get corners in local space of transform A
    var a = A.getLocalCorners();

    // Transform B's corners into A local space
    var bworld = B.getCorners();
    var b = [];
    for (var i = 0; i < 4; i++) {
        b[i] = A.toLocalSpace(bworld[i]);

        // Offsets x and y to fix perfect lines
        // where b[0] = b[1] & b[2] = b[3]
        b[i].x += 0.0001*i;
        b[i].y += 0.0001*i;
    }

    var corners = a.concat(b);

    var minA, maxA, minB, maxB;

    // SAT w/ x-axis
    // Axis is <1, 0>
    // So dot product is just the x-value
    minA = maxA = corners[0].x;
    minB = maxB = corners[4].x;
    for (var j = 1; j < 4; j++) {
        minA = Math.min(corners[j].x, minA);
        maxA = Math.max(corners[j].x, maxA);
        minB = Math.min(corners[j+4].x, minB);
        maxB = Math.max(corners[j+4].x, maxB);
    }
    if (maxA < minB || maxB < minA)
        return false;

    // SAT w/ y-axis
    // Axis is <1, 0>
    // So dot product is just the y-value
    minA = maxA = corners[0].y;
    minB = maxB = corners[4].y;
    for (var j = 1; j < 4; j++) {
        minA = Math.min(corners[j].y, minA);
        maxA = Math.max(corners[j].y, maxA);
        minB = Math.min(corners[j+4].y, minB);
        maxB = Math.max(corners[j+4].y, maxB);
    }
    if (maxA < minB || maxB < minA)
        return false;

    // SAT w/ other two axes
    var normals = [b[3].sub(b[0]), b[3].sub(b[2])];
    for (var i = 0; i < normals.length; i++) {
        var normal = normals[i];
        var minA = undefined, maxA = undefined;
        var minB = undefined, maxB = undefined;
        for (var j = 0; j < 4; j++) {
            var s = corners[j].dot(normal);
            minA = Math.min(s, (minA ? minA :  Infinity));
            maxA = Math.max(s, (maxA ? maxA : -Infinity));
            var s2 = corners[j+4].dot(normal);
            minB = Math.min(s2, (minB ? minB :  Infinity));
            maxB = Math.max(s2, (maxB ? maxB : -Infinity));
        }
        if (maxA < minB || maxB < minA)
            return false;
    }

    return true;
}

/**
 * Returns the nearest point on the edge
 * of the given rectangle.
 *
 * @param {Vector} bl   Bottom left corner of the rectangle
 * @param {Vector} tr   Top right corner of the rectangle
 * @param {Vector} pos  The position to get the nearest point on
 */
function getNearestPointOnRect(bl, tr, pos) {
    if (pos.x < bl.x)
        return V(bl.x, clamp(pos.y, bl.y, tr.y));
    if (pos.x > tr.x)
        return V(tr.x, clamp(pos.y, bl.y, tr.y));
    if (pos.y < bl.y)
        return V(clamp(pos.x, bl.x, tr.x), bl.y);
    if (pos.y > tr.y)
        return V(clamp(pos.x, bl.x, tr.x), tr.y);
    return V(0, 0);
}

/**
 * Finds and returns all the inter-connected wires
 * in a given group of objects
 *
 * @param  {Array}  objects
 *         The group of objects to find the wires
 *         in between
 *
 * @return {Array}
 *         The resulting wires
 */
function getAllWires(objects) {
    var wires = [];
    for (var i = 0; i < objects.length; i++) {
        var obj = objects[i];
        for (var j = 0; j < obj.outputs.length; j++) {
            var connections = obj.outputs[j].connections;
            for (var k = 0; k < connections.length; k++) {
                var wire = connections[k];
                do {
                    wires.push(wire);
                    wire = wire.connection;
                } while(wire instanceof Wire);
            }
        }
    }
    return wires;
}

/**
 * Finds and returns the object in the given
 * array that has the given uid (Unique Identification)
 *
 * @param  {Array} objects
 *         The group of objects the search
 *
 * @param  {Integer} uid
 *         The target unique identification to search for
 *
 * @return {IOObject}
 *         The object with the given uid or undefined if
 *         the object is not found
 */
function findByUID(objects, uid) {
    for (var i = 0; i < objects.length; i++) {
        if (objects[i].uid === uid)
            return objects[i];
    }
    return undefined;
}

/**
 * Finds and returns the IC from a given icuid
 *
 * @param  {Integer} id
 *         The icuid of the target IC
 *         (Integrated Circuit Unique Identification)
 *
 * @return {IC}
 *         The ic with the given icuid or undefined if
 *         the IC is not found
 */
function findIC(id) {
    for (var i = 0; i < ICs.length; i++) {
        if (ICs[i].icuid === id)
            return ICs[i];
    }
    return undefined;
}

// Separates an array of objects into three sub-groups
// of input-type objects (switch and buttons),
// output-type objects (LEDs),
// and other components.
function separateGroup(group) {
    var inputs = [];
    var components = [];
    var outputs = [];
    for (var i = 0; i < group.length; i++) {
        var object = group[i];
        if (object instanceof Switch || object instanceof Button)
            inputs.push(object);
        else if (object instanceof LED)
            outputs.push(object);
        else
            components.push(object);
    }
    return [inputs, components, outputs];
}

// Code from https://stackoverflow.com/questions/5916900/how-can-you-detect-the-version-of-a-browser
function getBrowser() {
    var ua=navigator.userAgent,tem,M=ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
    if(/trident/i.test(M[1])) {
        tem=/\brv[ :]+(\d+)/g.exec(ua) || [];
        return {name:'IE',version:(tem[1]||'')};
    }
    if(M[1]==='Chrome') {
        tem=ua.match(/\bOPR|Edge\/(\d+)/)
        if(tem!=null)   {return {name:'Opera', version:tem[1]};}
    }
    M=M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
    if((tem=ua.match(/version\/(\d+)/i))!=null) {M.splice(1,1,tem[1]);}
    return {
      name: M[0],
      version: M[1]
    };
 }
