# build-your-own-angularjs
AngularJS内部原理讲解。

## 第一部分 作用域

### 作用域和digest

- AngularJS通过$watch和$digest进行脏值检查达到双向绑定的目的
- 脏值检测循环和TTL（time to live）原理进行终止检测
- 通过不同的方式执行digest：直接用$eval和$apply，延时执行用$evalAsync和$$posotDigest
- 异常处理

### 作用域继承

- 如何创建子作用域
  通过`Object.create(obj)`进行原型链委托创建子作用域。
- 作用域继承和原生JavaScript原型的关系
- 属性覆盖及其含义
  子作用域通过修改父作用域中的对象的属性可以达到同时修改父作用域的值，而修改普通值如：number、string则是创建一个新的。
  这个掌握js中引用数据类型（array、object、function）和值数据类型（number、boolean、undfeind、null）后就没多大问题。
  建议ngModel中全部通过Obj.xx的形式调用。

- 父作用域中通过递归digest达到执行子作用域中的watch的目的
- $digest和$apply的区别
  性能问题，$digest()只会使当前作用域及其子作用域中的watch（包括$evalAsync和$$postDigest）执行，$apply会使rootScope下所有的watch都执行一遍。$evalAsync和$$postDigest同样会使rootScope下的所有watch都执行一遍。

- 独立作用域和普通子作用域的区别
  普通子作用域继承了父作用域的所有属性（通过原型链和父作用域关联起来），独立子作用域是一个新的作用域，无法访问父作用域的属性，通过this.$$root存储父作用域。

- 如何销毁一个子作用域
  从父作用域中的$$children中移除当前作用域，从而在下次执行digest时将不会执行当前作用域。

### 监听集合
`$watchCollection`在监听大数组和大对象上相比于`$watch`有较大的性能提升。因为它只做外层监听，**不做深层次监听**。
`$watchCollection`和`$watch`的区别：
- 用法：`$scope.$watchCollection(watchFn, listenerFn)`，`$scope.$watch(watchFn, listenerFn, valueEq)`。
- `$watch`当valueEq为false时，对于数组类型来说只做引用比较，把新数组赋给监听的数组时才可以出发`listener`，数组的增删改均不会触发`listener`。
- `$watchCollection`则还会监听数组内值的变化。
- `$watch`当valueEq为true时，则会对数组或对象进行深度值监听。

<table>
  <caption>3 种监听方式会在何时调用回调</caption>
  <tbody>
    <tr>
      <th></th>
      <th>$watch</th>
      <th>$watchCollection</th>
      <th>$watch Equality</th>
    </tr>
    <tr>
      <td>替换数组</td>
      <td>√</td>
      <td>√</td>
      <td>√</td>
    </tr>
    <tr>
      <td>替换数组<br>(元素实际值没变)</td>
      <td>√</td>
      <td>√</td>
      <td></td>
    </tr>
    <tr>
      <td>替换数组元素</td>
      <td></td>
      <td>√</td>
      <td>√</td>
    </tr>
    <tr>
      <td>替换数组元素<br>(元素内属性值没变)</td>
      <td></td>
      <td>√</td>
      <td></td>
    </tr>
    <tr>
      <td>新增/删除数组元素</td>
      <td></td>
      <td>√</td>
      <td>√</td>
    </tr>
    <tr>
      <td>更新数组元素的属性值</td>
      <td></td>
      <td></td>
      <td>√</td>
    </tr>
  </tbody>
</table>

### 作用域事件
- Angular事件是基于发布/订阅的设计模式，
  $on,$emit,$broadcast

- 事件的监听函数如何注入到scope上的
  每次监听一个事件，则把listener添加到scope.$$listener队列中。

- 作用域如何触发事件

- $emit和$broadcast的区别：
  $emit是执行当前作用域及其父作用域上的事件，$broadcast是执行当前作用域和子作用域的事件。$emit可以阻止事件冒泡，而$broadcast不能，所以$broadcast的执行消耗的性能较大。

- scope的event对象是什么？
  存储了当前事件名称，当前执行事件的作用域currentScope，触发事件的作用域targetScope，阻止默认行为事件。$emit中的event相对于$broadcast多了一个阻止冒泡函数。
```
event = {
  name: 'eventName',
  targetScope: this,
  currentScope: triggerScope,
  stopPropagation: function(){
    stopped = true
  },
  defaultPrevented: false,
  preventDefault: function(){
    event.defaultPrevented = true;
  }
}
```

- scope的一些属性是仿照DOM event模型来的：
  如阻止冒泡和阻止默认行为。

- 事件何时可以被停止，如何停止？
  如果是通过**$emit**来执行，想要阻止父作用域的事件触发，在当前作用域的listener中调用event.stopPropagation()函数即可。$broadcast则无法被阻止。


## 第二部分 表达式和过滤器
### 字面表达式
- 表达式解析器内部分两个阶段执行：词法分析和语法解析
- 如何处理整数、浮点数、科学计数的
- 如何处理字符串
- 如何处理布尔值和null
- 如何处理空白内容whitespace（`\n`、`\t`、`\v`、`\f`、`\r`、` `）
- 如何处理数组和对象，以及如何递归处理其中的内容
- 表达式解析如何集成到scope中，scope的哪些操作支持表达式（$watch、$watchCollection、$apply、$eval、$evalAsync）

