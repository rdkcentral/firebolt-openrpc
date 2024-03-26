#ifndef _TEST_UTILS_H
#define _TEST_UTILS_H

#include <stdio.h>
#include <stdbool.h>
#include <stdint.h>

#define MAX(x, y) (((x) > (y)) ? (x) : (y))
#define MIN(x, y) (((x) < (y)) ? (x) : (y))

#define _RESULT(expr, exprorig, result) if (expr) { printf("  SUCCESS: %s\n", #exprorig); __pass++; } else printf("  FAILED: %s, actual: %u\n", #exprorig, result)
#define _EVAL(result, expected, op) do { __cnt++; uint32_t resval = ((uint32_t)(result)); uint32_t expval = ((uint32_t)(expected)); _RESULT(resval op expval, result op expected, resval); } while(0)
#define _HEAD(name) printf("\n======== %s\n", name); __cnt = 0; __pass = 0
#define _FOOT(name) printf("\n======== %s - %i PASSED, %i FAILED\n", name, __pass, (__cnt - __pass)); TotalTests += __cnt; TotalTestsPassed += __pass;

#define EXECUTE(name, test) do { _HEAD(name); test(); _FOOT(name); printf("\n"); } while(0)
#define EXPECT_EQ(result, expected) _EVAL(result, expected, ==)
#define EXPECT_NE(result, expected) _EVAL(result, expected, !=)
#define EXPECT_LT(result, expected) _EVAL(result, expected, <)
#define EXPECT_LE(result, expected) _EVAL(result, expected, <=)
#define EXPECT_GT(result, expected) _EVAL(result, expected, >)
#define EXPECT_GE(result, expected) _EVAL(result, expected, >=)

#ifdef __cplusplus
extern "C" {
#endif

extern int __cnt;
extern int __pass;

extern int TotalTests ;
extern int TotalTestsPassed;

#ifdef __cplusplus
}
#endif

#endif // _TEST_UTILS_H
