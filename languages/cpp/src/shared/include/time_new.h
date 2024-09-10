#pragma once

#include <chrono>
#include <iostream>
#include <iomanip>

namespace FireboltSDK {
    namespace Core {
        class MyTime {
        public:
            static MyTime Now() {
                return MyTime(std::chrono::system_clock::now());
            }

            MyTime Add(std::chrono::milliseconds waitTime) {
                m_timePoint += waitTime;
                return *this;
            }

            long long Ticks() {
                return m_timePoint.time_since_epoch().count();
            }

            std::string ToTimeOnly(bool is24HourFormat) {
                std::time_t now_c = std::chrono::system_clock::to_time_t(m_timePoint);
                std::tm* now_tm = std::localtime(&now_c);

                std::stringstream ss;
                if (is24HourFormat) {
                    ss << std::put_time(now_tm, "%H:%M:%S");
                } else {
                    ss << std::put_time(now_tm, "%I:%M:%S %p");
                }
                return ss.str();
            }

            static constexpr int SecondsPerDay = 24 * 60 * 60;

        private:
            MyTime(std::chrono::system_clock::time_point timePoint)
                : m_timePoint(timePoint) {}

            std::chrono::system_clock::time_point m_timePoint;
        };
    }
}