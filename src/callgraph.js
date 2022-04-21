/*******************************************************************************
 * Copyright (c) 2013 Max Schaefer
 * Copyright (c) 2018 Persper Foundation
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *******************************************************************************/

/* Module for extracting a call graph from a flow graph. */
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function (require, exports) {
    var graph = require('./graph'),
        dftc = require('./dftc.js'),
        flowgraph = require('./flowgraph');
        JCG = require("./runner");
    const fs = require('fs');
    var path = require('path');


    // extract a call graph from a flow graph by collecting all function vertices that are inversely reachable from a callee vertex
    function extractCG(ast, flow_graph) {
        var edges = new graph.Graph(),
            escaping = [], unknown = [];

        var reach = dftc.reachability(flow_graph, function (nd) {
            return nd.type !== 'UnknownVertex';
        });

        /* fn is a flow graph node of type 'FuncVertex' */
        function processFuncVertex(fn) {
            var r = reach.getReachable(fn);
            r.forEach(function (nd) {
                if (nd.type === 'UnknownVertex')
                    escaping[escaping.length] = fn;
                else if (nd.type === 'CalleeVertex')
                    edges.addEdge(nd, fn);
            });
        }

        /*
        ast.attr.functions.forEach(function (fn) {
            processFuncVertex(flowgraph.funcVertex(fn));
        });
        */

        flow_graph.iterNodes(function (nd) {
            if (nd.type === 'FuncVertex'){
                processFuncVertex(nd);
            }
        });

        flowgraph.getNativeVertices().forEach(processFuncVertex);

        var unknown_r = reach.getReachable(flowgraph.unknownVertex());
        unknown_r.forEach(function (nd) {
            if (nd.type === 'CalleeVertex')
                unknown[unknown.length] = nd;
        });

        return {
            edges: edges,
            escaping: escaping,
            unknown: unknown,
            fg: flow_graph
        };
    }
    function writeCG(cg, iterNum){
        // Madhurima_ACG
        //let result = [];
        let resultObj = {};
        cg.edges.iter(function (call, fn) {
            //result.push(buildBinding(call, fn));
            if(JCG.args.encFuncInfo){
                var [encFunc,caller] = JCG.pp(call,true);
                var callee = JCG.pp(fn);
                if (!(encFunc in resultObj)) {
                    resultObj[encFunc] = {};
                }
                if (!(caller in resultObj[encFunc])) {
                    resultObj[encFunc][caller] = [];
                }
                resultObj[encFunc][caller].push(callee);
            }else{
                var caller = JCG.pp(call);
                var callee = JCG.pp(fn);
                if (!resultObj[caller]) {
                    resultObj[caller] = [];
                }
                resultObj[caller].push(callee);
            }
        });    
        let filename = JCG.args.output[0];
        var dirname;
        if (!filename.endsWith(".json")) {
            dirname = path.dirname(filename);
            if (!fs.existsSync(dirname)){
                fs.mkdirSync(dirname, { recursive: true });
            }
            filename += "JSSCG"+iterNum+".json";
        }

        fs.writeFile(filename, JSON.stringify(resultObj, null, 2), function (err) {
            if (err) {
                /*
                When happened something wrong (usually out of memory when we want print
                the result into a file), then we try to file with JSONStream.
                    */
                /*let transformStream = JSONStream.stringify();
                let outputStream = fs.createWriteStream(filename);
                transformStream.pipe(outputStream);
                result.forEach(transformStream.write);
                transformStream.end();*/
                console.log("Error while writing to file. Iteration :"+ iterNum)
            }
        });
    }

    exports.extractCG = extractCG;
    exports.writeCG = writeCG;
    return exports;
});
