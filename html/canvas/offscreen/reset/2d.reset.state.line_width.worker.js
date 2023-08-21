// DO NOT EDIT! This test has been generated by /html/canvas/tools/gentest.py.
// OffscreenCanvas test in a worker:2d.reset.state.line_width
// Description:check that the state is reset
// Note:

importScripts("/resources/testharness.js");
importScripts("/html/canvas/resources/canvas-tests.js");

var t = async_test("check that the state is reset");
var t_pass = t.done.bind(t);
var t_fail = t.step_func(function(reason) {
    throw reason;
});
t.step(function() {

  var canvas = new OffscreenCanvas(100, 50);
  var ctx = canvas.getContext('2d');

  const default_value = ctx.lineWidth;

  ctx.lineWidth = 1;
  _assert(ctx.lineWidth == 1, "ctx.lineWidth == 1");

  ctx.reset();
  _assert(ctx.lineWidth == default_value, "ctx.lineWidth == default_value");
  t.done();
});
done();
