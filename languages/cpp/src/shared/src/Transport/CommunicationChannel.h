/*
 * Copyright 2024 Comcast Cable Communications Management, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
#pragma once

#include <memory>
#include "Module.h"
#include "error.h"
#include "json_engine.h"

namespace FireboltSDK
{
    template <typename SOCKETTYPE, typename INTERFACE, typename CLIENT, typename MESSAGETYPE>
    class CommunicationChannel
    {
    public:
        typedef std::function<void(const INTERFACE &)> Callback;
        class Entry
        {
        private:
            Entry(const Entry &) = delete;
            Entry &operator=(const Entry &rhs) = delete;
            struct Synchronous
            {
                Synchronous()
                    : _signal(false, true), _response()
                {
                }
                WPEFramework::Core::Event _signal;
                std::list<WPEFramework::Core::ProxyType<MESSAGETYPE>> _response;
            };
            struct ASynchronous
            {
                ASynchronous(const uint32_t waitTime, const Callback &completed)
                    : _waitTime(WPEFramework::Core::Time::Now().Add(waitTime).Ticks()), _completed(completed)
                {
                }
                uint64_t _waitTime;
                Callback _completed;
            };

        public:
            Entry()
                : _synchronous(true), _info()
            {
            }
            Entry(const uint32_t waitTime, const Callback &completed)
                : _synchronous(false), _info(waitTime, completed)
            {
            }
            ~Entry()
            {
                if (_synchronous == true)
                {
                    _info.sync.~Synchronous();
                }
                else
                {
                    _info.async.~ASynchronous();
                }
            }

        public:
            const WPEFramework::Core::ProxyType<MESSAGETYPE> &Response() const
            {
                return (*(_info.sync._response.begin()));
            }
            bool Signal(const WPEFramework::Core::ProxyType<MESSAGETYPE> &response)
            {
                if (_synchronous == true)
                {
                    _info.sync._response.push_back(response);
                    _info.sync._signal.SetEvent();
                }
                else
                {
                    _info.async._completed(*response);
                }

                return (_synchronous == false);
            }
            const uint64_t &Expiry() const
            {
                return (_info.async._waitTime);
            }
            void Abort(const uint32_t id)
            {
                if (_synchronous == true)
                {
                    _info.sync._signal.SetEvent();
                }
                else
                {
                    MESSAGETYPE message;
                    ToMessage(id, message, WPEFramework::Core::ERROR_ASYNC_ABORTED);
                    _info.async._completed(message);
                }
            }
            bool Expired(const uint32_t id, const uint64_t &currentTime, uint64_t &nextTime)
            {
                bool expired = false;

                if (_synchronous == false)
                {
                    if (_info.async._waitTime > currentTime)
                    {
                        if (_info.async._waitTime < nextTime)
                        {
                            nextTime = _info.async._waitTime;
                        }
                    }
                    else
                    {
                        MESSAGETYPE message;
                        ToMessage(id, message, WPEFramework::Core::ERROR_TIMEDOUT);
                        _info.async._completed(message);
                        expired = true;
                    }
                }
                return (expired);
            }
            bool WaitForResponse(const uint32_t waitTime)
            {
                return (_info.sync._signal.Lock(waitTime) == WPEFramework::Core::ERROR_NONE);
            }

        private:
            void ToMessage(const uint32_t id, WPEFramework::Core::JSONRPC::Message &message, uint32_t error)
            {
                message.Id = id;
                message.Error.Code = error;
                switch (error)
                {
                case WPEFramework::Core::ERROR_ASYNC_ABORTED:
                {
                    message.Error.Text = _T("Pending a-sync call has been aborted");
                    break;
                }
                case WPEFramework::Core::ERROR_TIMEDOUT:
                {
                    message.Error.Text = _T("Pending a-sync call has timed out");
                    break;
                }
                }
            }

            bool _synchronous;
            union Info
            {
            public:
                Info()
                    : sync()
                {
                }
                Info(const uint32_t waitTime, const Callback &completed)
                    : async(waitTime, completed)
                {
                }
                ~Info()
                {
                }
                Synchronous sync;
                ASynchronous async;
            } _info;
        };

    private:
        class FactoryImpl
        {
        private:
            FactoryImpl(const FactoryImpl &) = delete;
            FactoryImpl &operator=(const FactoryImpl &) = delete;

            class WatchDog
            {
            private:
                WatchDog() = delete;
                WatchDog &operator=(const WatchDog &) = delete;

            public:
                WatchDog(CLIENT *client)
                    : _client(client)
                {
                }
                WatchDog(const WatchDog &copy)
                    : _client(copy._client)
                {
                }
                ~WatchDog()
                {
                }

                bool operator==(const WatchDog &rhs) const
                {
                    return (rhs._client == _client);
                }
                bool operator!=(const WatchDog &rhs) const
                {
                    return (!operator==(rhs));
                }

            public:
                uint64_t Timed(const uint64_t scheduledTime)
                {
                    return (_client->Timed());
                }

            private:
                CLIENT *_client;
            };

            friend WPEFramework::Core::SingletonType<FactoryImpl>;

            FactoryImpl()
                : _messageFactory(2), _watchDog(WPEFramework::Core::Thread::DefaultStackSize(), _T("TransportCleaner"))
            {
            }

        public:
            static FactoryImpl &Instance()
            {
                return (WPEFramework::Core::SingletonType<FactoryImpl>::Instance());
            }

            ~FactoryImpl()
            {
            }

        public:
            WPEFramework::Core::ProxyType<MESSAGETYPE> Element(const string &)
            {
                return (_messageFactory.Element());
            }
            void Trigger(const uint64_t &time, CLIENT *client)
            {
                _watchDog.Trigger(time, client);
            }
            void Revoke(CLIENT *client)
            {
                _watchDog.Revoke(client);
            }

        private:
            WPEFramework::Core::ProxyPoolType<MESSAGETYPE> _messageFactory;
            WPEFramework::Core::TimerType<WatchDog> _watchDog;
        };

        class ChannelImpl : public WPEFramework::Core::StreamJSONType<WPEFramework::Web::WebSocketClientType<SOCKETTYPE>, FactoryImpl &, INTERFACE>
        {
        private:
            ChannelImpl(const ChannelImpl &) = delete;
            ChannelImpl &operator=(const ChannelImpl &) = delete;

            typedef WPEFramework::Core::StreamJSONType<WPEFramework::Web::WebSocketClientType<SOCKETTYPE>, FactoryImpl &, INTERFACE> BaseClass;

        public:
            ChannelImpl(CommunicationChannel *parent, const WPEFramework::Core::NodeId &remoteNode, const string &path, const string &query, const bool mask)
                : BaseClass(5, FactoryImpl::Instance(), path, _T("JSON"), query, "", false, mask, false, remoteNode.AnyInterface(), remoteNode, 512, 512), _parent(*parent)
            {
            }
            ~ChannelImpl() override = default;

        public:
            void Received(WPEFramework::Core::ProxyType<INTERFACE> &response) override
            {
                WPEFramework::Core::ProxyType<MESSAGETYPE> inbound(response);

                ASSERT(inbound.IsValid() == true);
                if (inbound.IsValid() == true)
                {
                    _parent.Inbound(inbound);
                }
            }
            void Send(WPEFramework::Core::ProxyType<INTERFACE> &msg) override
            {
#ifdef __DEBUG__
                string message;
                ToMessage(msg, message);
                TRACE_L1("Message: %s send", message.c_str());
#endif
            }
            void StateChange() override
            {
                _parent.StateChange();
            }
            bool IsIdle() const override
            {
                return (true);
            }

        private:
            void ToMessage(const WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::IElement> &jsonObject, string &message) const
            {
                WPEFramework::Core::ProxyType<WPEFramework::Core::JSONRPC::Message> inbound(jsonObject);

                ASSERT(inbound.IsValid() == true);
                if (inbound.IsValid() == true)
                {
                    inbound->ToString(message);
                }
            }
            void ToMessage(const WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::IMessagePack> &jsonObject, string &message) const
            {
                WPEFramework::Core::ProxyType<WPEFramework::Core::JSONRPC::Message> inbound(jsonObject);

                ASSERT(inbound.IsValid() == true);
                if (inbound.IsValid() == true)
                {
                    std::vector<uint8_t> values;
                    inbound->ToBuffer(values);
                    if (values.empty() != true)
                    {
                        WPEFramework::Core::ToString(values.data(), static_cast<uint16_t>(values.size()), false, message);
                    }
                }
            }

        private:
            CommunicationChannel &_parent;
        };

    protected:
        CommunicationChannel(const WPEFramework::Core::NodeId &remoteNode, const string &path, const string &query, const bool mask)
            : _channel(this, remoteNode, path, query, mask), _sequence(0)
        {
        }

    public:
        ~CommunicationChannel() = default;
        static WPEFramework::Core::ProxyType<CommunicationChannel> Instance(const WPEFramework::Core::NodeId &remoteNode, const string &path, const string &query, const bool mask = true)
        {
            static WPEFramework::Core::ProxyMapType<string, CommunicationChannel> channelMap;

            string searchLine = remoteNode.HostAddress() + '@' + path;

            return (channelMap.template Instance<CommunicationChannel>(searchLine, remoteNode, path, query, mask));
        }

    public:
        static void Trigger(const uint64_t &time, CLIENT *client)
        {
            FactoryImpl::Instance().Trigger(time, client);
        }
        static WPEFramework::Core::ProxyType<MESSAGETYPE> Message()
        {
            return (FactoryImpl::Instance().Element(string()));
        }
        uint32_t Sequence() const
        {
            return (++_sequence);
        }
        void Register(CLIENT &client)
        {
            _adminLock.Lock();
            ASSERT(std::find(_observers.begin(), _observers.end(), &client) == _observers.end());
            _observers.push_back(&client);
            if (true)
            {
                client.Opened();
            }
            _adminLock.Unlock();
        }
        void Unregister(CLIENT &client)
        {
            _adminLock.Lock();
            typename std::list<CLIENT *>::iterator index(std::find(_observers.begin(), _observers.end(), &client));
            if (index != _observers.end())
            {
                _observers.erase(index);
            }
            FactoryImpl::Instance().Revoke(&client);
            _adminLock.Unlock();
        }

// Send requests to JSON engine's mockRequest method for unit testing instead of channel's submit method
#if defined(UNIT_TEST)
        void Submit(const WPEFramework::Core::ProxyType<INTERFACE> &message)
        {
            const WPEFramework::Core::JSONRPC::Message *jsonRpcMessage = dynamic_cast<const WPEFramework::Core::JSONRPC::Message *>(message.operator->());
            std::unique_ptr<JsonEngine> jsonEngine = std::make_unique<JsonEngine>();
            jsonEngine->MockRequest(jsonRpcMessage);
        }
#else

        void Submit(const WPEFramework::Core::ProxyType<INTERFACE> &message)
        {
            _channel.Submit(message);
        }
#endif
        bool IsSuspended() const
        {
            return (_channel.IsSuspended());
        }
        uint32_t Initialize()
        {
            return (Open(0));
        }
        void Deinitialize()
        {
            Close();
        }

// Always return true for unit testing
#if defined(UNIT_TEST)
        bool IsOpen()
        {
            return true;
        }
#else
        bool IsOpen()
        {
            return _channel.IsOpen();
        }
#endif

    protected:
        void StateChange()
        {
            _adminLock.Lock();
            typename std::list<CLIENT *>::iterator index(_observers.begin());
            while (index != _observers.end())
            {
                if (_channel.IsOpen() == true)
                {
                    (*index)->Opened();
                }
                else
                {
                    (*index)->Closed();
                }
                index++;
            }
            _adminLock.Unlock();
        }

// Always return true for unit testing       
#if defined(UNIT_TEST)
        bool Open(const uint32_t waitTime)
        {
            return true;
        }
#else
        bool Open(const uint32_t waitTime)
        {
            bool result = true;
            if (_channel.IsClosed() == true) {
                result = (_channel.Open(waitTime) == WPEFramework::Core::ERROR_NONE);
            }
            return (result);
        }
        
#endif
        void Close()
        {
            _channel.Close(WPEFramework::Core::infinite);
        }

    private:
        int32_t Inbound(const WPEFramework::Core::ProxyType<MESSAGETYPE> &inbound)
        {
            int32_t result = WPEFramework::Core::ERROR_UNAVAILABLE;
            _adminLock.Lock();
            typename std::list<CLIENT *>::iterator index(_observers.begin());
            while ((result != WPEFramework::Core::ERROR_NONE) && (index != _observers.end()))
            {
                result = (*index)->Submit(inbound);
                index++;
            }
            _adminLock.Unlock();

            return (result);
        }

    private:
        WPEFramework::Core::CriticalSection _adminLock;
        ChannelImpl _channel;
        mutable std::atomic<uint32_t> _sequence;
        std::list<CLIENT *> _observers;
    };
}
