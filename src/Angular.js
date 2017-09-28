/* jshint globalstrict: true */
'use strict';

_.mixin({
    isArrayLike: function(obj) {

        // 肯定不是类数组
        if (obj === null || isWindow(obj) || obj === undefined) {
            return false;
        }

        // 数组和string都是类数组对象
        if (isArray(obj) || isString(obj)) {
            return true;
        }

        // 这个length就很尴尬了，到底真的是类数组的长度，还是obj的一个length的属性？
        var length = obj.length;

        /**
         * 判断是arraylike条件：
         * 1、obj.length是一个数值，如：obj.length = 'a'这就肯定是一个对象了
         * 2、如果存在length，作为一个obj=['a','b','c']这样的类数组对象，一定存在obj[length-1]
         */
        return isNumber(length) && length > 0 && (length - 1) in obj;

    },
    isObject: function(value) {
        // http://jsperf.com/isobject4
        return value !== null && typeof value === 'object';
    }
});
/**
 * 检测`obj`是否是window对象
 * @param  {object}   obj 
 * @return {Boolean}      true：是window对象
 * @author zhaoke@haizhi.com
 * @date   2016-10-20
 */
function isWindow(obj) {
    return obj && obj.window === obj;
}

var isArray = Array.isArray;

function isString(value) {
    return typeof value === 'string';
}

function isNumber(value) {
    return typeof value === 'number';
}


/**
 * 合并两个数组
 * @param  {array}   array1 [description]
 * @param  {array}   array2 [description]
 * @param  {number}   index  [description]
 */
// function concat(array1, array2, index) {
//   return array1.concat(slice.call(array2, index));
// }